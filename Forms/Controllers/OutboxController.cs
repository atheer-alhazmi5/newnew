using FormsSystem.Services;
using Microsoft.AspNetCore.Mvc;

namespace FormsSystem.Controllers;

public class OutboxController : BaseController
{
    private readonly DataService _ds;
    private readonly UiHelperService _ui;

    public OutboxController(DataService ds, UiHelperService ui) { _ds = ds; _ui = ui; }

    public IActionResult Index()
    {
        var auth = RequireAuth(); if (auth != null) return auth;
        SetViewBagUser(_ui);
        return View();
    }

    [HttpGet]
    public async Task<IActionResult> GetItems(string? status)
    {
        if (!IsAuthenticated) return Json(new { success = false });
        var items = await _ds.ListSentFormsAsync(CurrentUserId);
        if (!string.IsNullOrEmpty(status))
            items = items.Where(s => s.Status == status).ToList();

        return Json(new
        {
            success = true,
            data = items.Select(s => new
            {
                s.Id, s.FormId, s.FormName, s.FormIcon,
                s.SenderName, s.SentDate, s.Status, s.FormStatus,
                sentToJson = s.SentToJson,
                s.StartDate, s.EndDate
            })
        });
    }

    // GetReplies: accepts formId (used by outbox.js) or sentFormId (legacy)
    [HttpGet]
    public async Task<IActionResult> GetReplies(int? formId, int? sentFormId)
    {
        if (!IsAuthenticated) return Json(new { success = false });

        int targetFormId = 0;
        if (sentFormId.HasValue)
        {
            var sf = await _ds.GetSentFormByIdAsync(sentFormId.Value);
            if (sf == null || sf.SenderId != CurrentUserId)
                return Json(new { success = false });
            targetFormId = sf.FormId;
        }
        else if (formId.HasValue)
        {
            targetFormId = formId.Value;
        }
        else return Json(new { success = false });

        var replies = await _ds.ListRepliesByFormIdAsync(targetFormId);
        return Json(new
        {
            success = true,
            data = replies.Select(r => new
            {
                r.Id, r.ResponderId, r.ResponderName,
                r.ResponderDepartment, r.ReplyDate, r.AnswersJson
            })
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetReplyDetail(int replyId)
    {
        if (!IsAuthenticated) return Json(new { success = false });
        var reply = await _ds.GetReplyByIdAsync(replyId);
        if (reply == null)
            return Json(new { success = false, message = "الرد غير موجود" });
        return Json(new
        {
            success = true,
            data = new
            {
                reply.Id, reply.ResponderName, reply.ResponderDepartment,
                reply.ReplyDate, reply.AnswersJson
            }
        });
    }
}
