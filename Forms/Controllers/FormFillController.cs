using FormsSystem.Models.Entities;
using FormsSystem.Services;
using Microsoft.AspNetCore.Mvc;

namespace FormsSystem.Controllers;

public class FormFillController : BaseController
{
    private readonly DataService _ds;
    private readonly UiHelperService _ui;

    public FormFillController(DataService ds, UiHelperService ui) { _ds = ds; _ui = ui; }

    public async Task<IActionResult> Index(int formId, int? receivedFormId, string mode = "fill")
    {
        var auth = RequireAuth(); if (auth != null) return auth;
        SetViewBagUser(_ui);
        ViewBag.FormId = formId;
        ViewBag.ReceivedFormId = receivedFormId;
        ViewBag.Mode = mode;

        var form = await _ds.GetFormByIdAsync(formId);
        if (form == null) return RedirectToAction("Index", "Forms");
        ViewBag.FormName = form.Name;
        return View();
    }

    // Alias for form-fill.js compatibility
    [HttpGet]
    public async Task<IActionResult> GetReceivedForm(int id)
    {
        if (!IsAuthenticated) return Json(new { success = false });
        var rf = await _ds.GetReceivedFormByIdAsync(id);
        if (rf == null) return Json(new { success = false, message = "لم يُعثر على النموذج" });
        var form = await _ds.GetFormByIdAsync(rf.FormId);
        if (form == null) return Json(new { success = false });
        await _ds.MarkReceivedFormReadAsync(id);
        return Json(new
        {
            success = true,
            data = new { rf.Id, rf.FormId, rf.FormName, rf.Status, rf.AnswersJson, rf.Category },
            form = new { form.Id, form.Name, form.Description, form.Icon, form.SectionsJson }
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetFormData(int formId, int? receivedFormId)
    {
        if (!IsAuthenticated) return Json(new { success = false });
        var form = await _ds.GetFormByIdAsync(formId);
        if (form == null) return Json(new { success = false, message = "النموذج غير موجود" });

        object? answers = null;
        if (receivedFormId.HasValue)
        {
            var rf = await _ds.GetReceivedFormByIdAsync(receivedFormId.Value);
            if (rf != null)
            {
                answers = rf.AnswersJson;
                await _ds.MarkReceivedFormReadAsync(receivedFormId.Value);
            }
        }

        return Json(new
        {
            success = true,
            form = new
            {
                form.Id, form.Name, form.Description, form.Icon,
                form.SectionsJson, form.StartDate, form.EndDate
            },
            answers
        });
    }

    [HttpPost]
    public async Task<IActionResult> Submit([FromBody] SubmitFormRequest req)
    {
        if (!IsAuthenticated) return Json(new { success = false });

        var rf = req.ReceivedFormId.HasValue
            ? await _ds.GetReceivedFormByIdAsync(req.ReceivedFormId.Value)
            : null;

        var form = await _ds.GetFormByIdAsync(req.FormId);
        if (form == null) return Json(new { success = false, message = "النموذج غير موجود" });

        var answersJson = !string.IsNullOrEmpty(req.AnswersJson)
            ? req.AnswersJson
            : System.Text.Json.JsonSerializer.Serialize(req.Answers);

        if (rf != null)
        {
            rf.AnswersJson = answersJson;
            rf.Status = "تم الملء";
            rf.ReplyDate = DateTime.Now;
            rf.IsRead = true;
            await _ds.UpdateReceivedFormAsync(rf);

            await _ds.AddReplyAsync(new Reply
            {
                ReceivedFormId = rf.Id, FormId = form.Id, FormName = form.Name,
                ResponderId = CurrentUserId, ResponderName = CurrentUserFullName,
                ResponderDepartment = CurrentDeptName,
                AnswersJson = answersJson
            });

            await _ds.CreateNotificationAsync(new Notification
            {
                FormId = form.Id, FormName = form.Name,
                RecipientId = rf.SenderId,
                Type = "form_reply",
                Title = $"تم ملء النموذج: {form.Name}",
                Message = $"قام {CurrentUserFullName} بملء النموذج ({form.Name})",
                SenderName = CurrentUserFullName, SenderDepartment = CurrentDeptName
            });
        }

        await _ds.AddAuditLogAsync(BuildAuditEntry("تعبئة نموذج", "Form",
            form.Id.ToString()));

        return Json(new { success = true, message = "تم إرسال النموذج بنجاح" });
    }

    [HttpGet]
    public async Task<IActionResult> PrintView(int formId, int? replyId)
    {
        if (!IsAuthenticated) return Json(new { success = false });
        var form = await _ds.GetFormByIdAsync(formId);
        if (form == null) return NotFound();

        Reply? reply = null;
        if (replyId.HasValue)
            reply = await _ds.GetReplyByIdAsync(replyId.Value);

        ViewBag.FormData = form;
        ViewBag.ReplyData = reply;
        return View("PrintView");
    }
}

public class SubmitFormRequest
{
    public int FormId { get; set; }
    public int? ReceivedFormId { get; set; }
    public string? AnswersJson { get; set; }
    public Dictionary<string, object?> Answers { get; set; } = new();
}
