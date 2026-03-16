using FormsSystem.Models.Entities;
using FormsSystem.Services;
using Microsoft.AspNetCore.Mvc;

namespace FormsSystem.Controllers;

public class InboxController : BaseController
{
    private readonly DataService _ds;
    private readonly UiHelperService _ui;

    public InboxController(DataService ds, UiHelperService ui) { _ds = ds; _ui = ui; }

    public IActionResult Index()
    {
        var auth = RequireAuth(); if (auth != null) return auth;
        SetViewBagUser(_ui);
        return View();
    }

    [HttpGet]
    public async Task<IActionResult> GetItems(string? category, string? status)
    {
        if (!IsAuthenticated) return Json(new { success = false });
        var items = await _ds.ListReceivedFormsAsync(CurrentUserId, category);
        if (!string.IsNullOrEmpty(status))
            items = items.Where(r => r.Status == status).ToList();

        return Json(new
        {
            success = true,
            data = items.Select(r => new
            {
                r.Id, r.FormId, r.FormName, r.FormIcon,
                r.SenderName, r.SenderDepartment, r.Category,
                r.SentDate, r.Status, r.IsRead, r.ReplyDate,
                r.SentFormId, r.TargetRecipientsJson
            })
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetInbox(int page = 1, int pageSize = 5,
        string? category = null, string? status = null)
    {
        if (!IsAuthenticated) return Json(new { success = false });
        var items = await _ds.ListReceivedFormsAsync(CurrentUserId, category);
        if (!string.IsNullOrEmpty(status))
            items = items.Where(r => r.Status == status).ToList();

        var paged = items.Skip((page - 1) * pageSize).Take(pageSize).ToList();
        return Json(new
        {
            success = true,
            data = paged.Select(r => new
            {
                r.Id, r.FormId, r.FormName, r.FormIcon,
                r.SenderName, r.SenderDepartment, r.Category,
                r.SentDate, r.Status, r.IsRead, r.ReplyDate
            }),
            total = items.Count
        });
    }

    [HttpPost]
    public async Task<IActionResult> MarkRead(int id)
    {
        if (!IsAuthenticated) return Json(new { success = false });
        await _ds.MarkReceivedFormReadAsync(id);
        return Json(new { success = true });
    }

    [HttpPost]
    public async Task<IActionResult> Approve([FromBody] ApproveRejectRequest req)
    {
        if (!IsAuthenticated) return Json(new { success = false });
        if (CurrentUserRole != "Admin" && CurrentUserRole != "Manager")
            return Json(new { success = false, message = "غير مصرح" });

        var rf = await _ds.GetReceivedFormByIdAsync(req.ReceivedFormId);
        if (rf == null || rf.Category != "approval_request")
            return Json(new { success = false, message = "طلب الاعتماد غير موجود" });

        rf.Status = "معتمد";
        rf.IsRead = true;
        rf.ReplyDate = DateTime.Now;
        await _ds.UpdateReceivedFormAsync(rf);

        if (rf.SentFormId.HasValue)
        {
            var sf = await _ds.GetSentFormByIdAsync(rf.SentFormId.Value);
            if (sf != null)
            {
                sf.Status = "published";
                await _ds.UpdateSentFormAsync(sf);
            }
        }

        var form = await _ds.GetFormByIdAsync(rf.FormId);
        if (form == null)
            return Json(new { success = true, message = "تم الاعتماد" });

        var targetRecipients = new List<dynamic>();
        if (!string.IsNullOrEmpty(rf.TargetRecipientsJson))
        {
            try
            {
                var arr = System.Text.Json.JsonSerializer.Deserialize<List<System.Text.Json.JsonElement>>(rf.TargetRecipientsJson);
                if (arr != null)
                {
                    foreach (var item in arr)
                    {
                        var id = item.GetProperty("id").GetInt32();
                        var name = item.GetProperty("fullName").GetString() ?? "";
                        targetRecipients.Add(new { Id = id, FullName = name });
                    }
                }
            }
            catch { }
        }

        foreach (var r in targetRecipients)
        {
            await _ds.AddReceivedFormAsync(new ReceivedForm
            {
                FormId = form.Id, FormName = form.Name, FormIcon = form.Icon,
                SenderId = rf.SenderId, SenderName = rf.SenderName,
                SenderDepartment = rf.SenderDepartment,
                RecipientId = r.Id, RecipientName = r.FullName,
                Category = "fill_request",
                SentFormId = rf.SentFormId
            });
            await _ds.CreateNotificationAsync(new Notification
            {
                FormId = form.Id, FormName = form.Name,
                RecipientId = r.Id, Type = "fill_request",
                Title = $"نموذج جديد: {form.Name}",
                Message = $"أرسل إليك {rf.SenderName} نموذج ({form.Name}) للتعبئة",
                SenderName = rf.SenderName, SenderDepartment = rf.SenderDepartment
            });
        }

        await _ds.CreateNotificationAsync(new Notification
        {
            FormId = form.Id, FormName = form.Name,
            RecipientId = rf.SenderId, Type = "form_reply",
            Title = $"تم اعتماد النموذج: {form.Name}",
            Message = $"قام {CurrentUserFullName} باعتماد نموذج ({form.Name})",
            SenderName = CurrentUserFullName, SenderDepartment = CurrentDeptName
        });

        await _ds.AddAuditLogAsync(CurrentUserId, CurrentUserFullName,
            "اعتماد نموذج", "Form", form.Id.ToString(), $"من {rf.SenderName}");

        return Json(new { success = true, message = "تم اعتماد النموذج وإرساله للمستهدفين" });
    }

    [HttpPost]
    public async Task<IActionResult> Reject([FromBody] ApproveRejectRequest req)
    {
        if (!IsAuthenticated) return Json(new { success = false });
        if (CurrentUserRole != "Admin" && CurrentUserRole != "Manager")
            return Json(new { success = false, message = "غير مصرح" });

        var rf = await _ds.GetReceivedFormByIdAsync(req.ReceivedFormId);
        if (rf == null || rf.Category != "approval_request")
            return Json(new { success = false, message = "طلب الاعتماد غير موجود" });

        rf.Status = "مرفوض";
        rf.IsRead = true;
        rf.ReplyDate = DateTime.Now;
        await _ds.UpdateReceivedFormAsync(rf);

        if (rf.SentFormId.HasValue)
        {
            var sf = await _ds.GetSentFormByIdAsync(rf.SentFormId.Value);
            if (sf != null)
            {
                sf.Status = "rejected";
                await _ds.UpdateSentFormAsync(sf);
            }
        }

        var form = await _ds.GetFormByIdAsync(rf.FormId);
        await _ds.CreateNotificationAsync(new Notification
        {
            FormId = rf.FormId, FormName = rf.FormName,
            RecipientId = rf.SenderId, Type = "form_reply",
            Title = $"تم رفض النموذج: {rf.FormName}",
            Message = $"قام {CurrentUserFullName} برفض نموذج ({rf.FormName})",
            SenderName = CurrentUserFullName, SenderDepartment = CurrentDeptName
        });

        return Json(new { success = true, message = "تم رفض النموذج" });
    }
}

public class ApproveRejectRequest
{
    public int ReceivedFormId { get; set; }
}
