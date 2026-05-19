using FormsSystem.Models.Entities;
using FormsSystem.Services;
using Microsoft.AspNetCore.Mvc;

namespace FormsSystem.Controllers;

public partial class InboxController : BaseController
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

        // طلبات النماذج (السلوك القديم)
        var formItems = await _ds.ListReceivedFormsAsync(CurrentUserId, category);
        if (!string.IsNullOrEmpty(status))
            formItems = formItems.Where(r => r.Status == status).ToList();

        var unifiedForms = formItems.Select(r => new InboxItemDto
        {
            Id = r.Id,
            Source = "form",
            FormId = r.FormId,
            FormName = r.FormName,
            FormIcon = r.FormIcon,
            SenderName = r.SenderName,
            SenderDepartment = r.SenderDepartment,
            Category = r.Category,
            SentDate = r.SentDate,
            Status = r.Status,
            IsRead = r.IsRead,
            ReplyDate = r.ReplyDate,
            SentFormId = r.SentFormId,
            TargetRecipientsJson = r.TargetRecipientsJson
        }).ToList();

        // طلبات إجراءات العمل (المضافة): تظهر كفئة "request_review"
        var includeRequests = string.IsNullOrEmpty(category) || category == "request_review";
        var unifiedRequests = new List<InboxItemDto>();
        if (includeRequests)
        {
            var asgs = await _ds.ListOutboxAssignmentsForUserAsync(CurrentUserId);
            if (!string.IsNullOrEmpty(status))
                asgs = asgs.Where(a => a.Status == status).ToList();

            unifiedRequests = asgs.Select(a => new InboxItemDto
            {
                Id = a.Id,
                Source = "outbox_request",
                FormId = 0,
                AssignmentId = a.Id,
                OutboxRequestId = a.OutboxRequestId,
                FormName = $"{a.RequestNumber} — {a.ProcedureName}",
                FormIcon = "document",
                ProcedureName = a.ProcedureName,
                ProcedureCode = a.ProcedureCode,
                ProcedureTypeIcon = a.ProcedureTypeIcon,
                ProcedureTypeColor = a.ProcedureTypeColor,
                RequestNumber = a.RequestNumber,
                StepLabel = a.StepLabel,
                AssignedVia = a.AssignedVia,
                SenderName = a.SenderName,
                SenderDepartment = a.SenderDept,
                Category = "request_review",
                SentDate = a.AssignedAt,
                Status = a.Status,
                IsRead = a.IsRead,
                ReplyDate = a.ActedAt
            }).ToList();
        }

        // دمج وفرز موحَّد حسب التاريخ التنازلي
        var all = unifiedForms.Concat(unifiedRequests).OrderByDescending(x => x.SentDate).ToList();

        return Json(new { success = true, data = all });
    }

    private class InboxItemDto
    {
        public int Id { get; set; }
        public string Source { get; set; } = "form";
        public int FormId { get; set; }
        public int? AssignmentId { get; set; }
        public int? OutboxRequestId { get; set; }
        public string FormName { get; set; } = "";
        public string FormIcon { get; set; } = "";
        public string ProcedureName { get; set; } = "";
        public string ProcedureCode { get; set; } = "";
        public string ProcedureTypeIcon { get; set; } = "";
        public string ProcedureTypeColor { get; set; } = "";
        public string RequestNumber { get; set; } = "";
        public string StepLabel { get; set; } = "";
        public string AssignedVia { get; set; } = "";
        public string SenderName { get; set; } = "";
        public string SenderDepartment { get; set; } = "";
        public string Category { get; set; } = "";
        public DateTime SentDate { get; set; }
        public string Status { get; set; } = "";
        public bool IsRead { get; set; }
        public DateTime? ReplyDate { get; set; }
        public int? SentFormId { get; set; }
        public string? TargetRecipientsJson { get; set; }
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

        await _ds.AddAuditLogAsync(BuildAuditEntry("اعتماد نموذج", "Form", form.Id.ToString(), $"من {rf.SenderName}"));

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

public partial class InboxController
{
    // ─── OUTBOX REQUEST ASSIGNMENTS (تسليمات طلبات الإجراءات داخل الوارد) ─────
    [HttpGet]
    public async Task<IActionResult> GetRequestAssignment(int id)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        var a = await _ds.GetOutboxAssignmentByIdAsync(id);
        if (a == null || a.RecipientUserId != CurrentUserId)
            return Json(new { success = false, message = "غير موجود" });

        // علِّمه مقروءاً عند الفتح
        await _ds.MarkOutboxAssignmentReadAsync(id, CurrentUserId);

        var req = await _ds.GetOutboxRequestByIdAsync(a.OutboxRequestId);
        return Json(new
        {
            success = true,
            data = new
            {
                a.Id,
                a.OutboxRequestId,
                a.RequestNumber,
                a.WorkProcedureId,
                a.ProcedureName,
                a.ProcedureCode,
                a.ProcedureTypeName,
                a.ProcedureTypeIcon,
                a.ProcedureTypeColor,
                a.StepLabel,
                a.AssignedVia,
                a.SenderName,
                a.SenderDept,
                a.Status,
                a.Action,
                a.ResponseNotes,
                AssignedAt = a.AssignedAt.ToString("yyyy-MM-dd HH:mm"),
                ActedAt = a.ActedAt?.ToString("yyyy-MM-dd HH:mm"),
                FormDataJson = req?.FormDataJson ?? "{}",
                RequestNotes = req?.Notes ?? "",
                Priority = req?.Priority ?? "",
                SubmittedAt = req?.SubmittedAt.ToString("yyyy-MM-dd HH:mm") ?? ""
            }
        });
    }

    public class ActOnAssignmentDto
    {
        public int AssignmentId { get; set; }
        public string Action { get; set; } = "";   // approve | reject | return
        public string Notes { get; set; } = "";
    }

    [HttpPost]
    public async Task<IActionResult> ActOnAssignment([FromBody] ActOnAssignmentDto req)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        if (req == null || req.AssignmentId <= 0)
            return Json(new { success = false, message = "غير صالح" });

        var a = await _ds.GetOutboxAssignmentByIdAsync(req.AssignmentId);
        if (a == null || a.RecipientUserId != CurrentUserId)
            return Json(new { success = false, message = "غير مصرح" });
        if (a.Status != "قيد الانتظار")
            return Json(new { success = false, message = "تم اتخاذ إجراء على هذا الطلب مسبقاً" });

        var action = (req.Action ?? "").Trim().ToLowerInvariant();
        string newStatus;
        string title;
        if (action == "approve") { newStatus = "تم الاعتماد"; title = "تم اعتماد طلبك"; }
        else if (action == "reject") { newStatus = "تم الرفض"; title = "تم رفض طلبك"; }
        else if (action == "return") { newStatus = "تم الإرجاع"; title = "تم إرجاع طلبك"; }
        else return Json(new { success = false, message = "إجراء غير معروف" });

        var notes = (req.Notes ?? "").Trim();
        if ((action == "reject" || action == "return") && string.IsNullOrEmpty(notes))
            return Json(new { success = false, message = "السبب مطلوب عند الرفض/الإرجاع" });

        a.Action = action;
        a.Status = newStatus;
        a.ResponseNotes = notes;
        a.ActedAt = DateTime.Now;
        a.IsRead = true;
        a.ReadAt ??= DateTime.Now;
        await _ds.UpdateOutboxAssignmentAsync(a);

        // إشعار مُقدِّم الطلب
        await _ds.CreateNotificationAsync(new Notification
        {
            RecipientId = a.SenderId,
            Type = "request_update",
            Title = $"{title}: {a.RequestNumber}",
            Message = $"{CurrentUserFullName} {newStatus} طلب «{a.ProcedureName}»" + (notes.Length > 0 ? $" — السبب: {notes}" : ""),
            SenderName = CurrentUserFullName,
            SenderDepartment = CurrentDeptName
        });

        await _ds.AddAuditLogAsync(BuildAuditEntry(newStatus, "OutboxAssignment", a.Id.ToString(), a.RequestNumber));
        return Json(new { success = true, message = $"تم تنفيذ: {newStatus}" });
    }
}
