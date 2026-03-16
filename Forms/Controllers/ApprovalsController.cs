using FormsSystem.Services;
using Microsoft.AspNetCore.Mvc;

namespace FormsSystem.Controllers;

public class ApprovalsController : BaseController
{
    private readonly DataService _ds;
    private readonly UiHelperService _ui;

    public ApprovalsController(DataService ds, UiHelperService ui) { _ds = ds; _ui = ui; }

    public IActionResult Index()
    {
        var auth = RequireAuth(); if (auth != null) return auth;
        if (CurrentUserRole != "Manager" && CurrentUserRole != "Admin")
            return RedirectToAction("Index", "Forms");
        SetViewBagUser(_ui);
        return View();
    }

    [HttpGet]
    public async Task<IActionResult> GetPending()
    {
        if (!IsAuthenticated) return Json(new { success = false });
        var items = await _ds.ListApprovalRequestsForManagerAsync(CurrentUserId, CurrentDeptId);
        return Json(new
        {
            success = true,
            data = items.Select(r => new
            {
                r.Id, r.FormId, r.FormName, r.SenderName,
                r.SenderDepartment, r.SentDate, r.Status, r.IsRead
            })
        });
    }

    [HttpPost]
    public async Task<IActionResult> Approve(int receivedFormId)
    {
        if (!IsAuthenticated || (CurrentUserRole != "Manager" && CurrentUserRole != "Admin"))
            return Json(new { success = false, message = "غير مصرح" });

        var rf = await _ds.GetReceivedFormByIdAsync(receivedFormId);
        if (rf == null) return Json(new { success = false });

        rf.Status = "معتمد";
        rf.IsRead = true;
        rf.ReplyDate = DateTime.UtcNow;
        await _ds.UpdateReceivedFormAsync(rf);

        // Update related sent form
        var form = await _ds.GetFormByIdAsync(rf.FormId);

        await _ds.CreateNotificationAsync(new Models.Entities.Notification
        {
            FormId = rf.FormId, FormName = rf.FormName,
            RecipientId = rf.SenderId, Type = "form_reply",
            Title = $"تم اعتماد النموذج: {rf.FormName}",
            Message = $"قام {CurrentUserFullName} باعتماد النموذج ({rf.FormName})",
            SenderName = CurrentUserFullName, SenderDepartment = CurrentDeptName
        });

        await _ds.AddAuditLogAsync(CurrentUserId, CurrentUserFullName, "اعتماد نموذج",
            "ReceivedForm", receivedFormId.ToString());

        return Json(new { success = true, message = "تم الاعتماد بنجاح" });
    }

    [HttpPost]
    public async Task<IActionResult> Reject(int receivedFormId, [FromBody] RejectRequest? req)
    {
        if (!IsAuthenticated || (CurrentUserRole != "Manager" && CurrentUserRole != "Admin"))
            return Json(new { success = false, message = "غير مصرح" });

        var rf = await _ds.GetReceivedFormByIdAsync(receivedFormId);
        if (rf == null) return Json(new { success = false });

        rf.Status = "مرفوض";
        rf.IsRead = true;
        rf.ReplyDate = DateTime.UtcNow;
        await _ds.UpdateReceivedFormAsync(rf);

        await _ds.CreateNotificationAsync(new Models.Entities.Notification
        {
            FormId = rf.FormId, FormName = rf.FormName,
            RecipientId = rf.SenderId, Type = "form_reply",
            Title = $"تم رفض النموذج: {rf.FormName}",
            Message = $"قام {CurrentUserFullName} برفض النموذج ({rf.FormName})" +
                      (req?.Reason != null ? $": {req.Reason}" : ""),
            SenderName = CurrentUserFullName, SenderDepartment = CurrentDeptName
        });

        return Json(new { success = true, message = "تم الرفض" });
    }
}

public class RejectRequest { public string? Reason { get; set; } }
