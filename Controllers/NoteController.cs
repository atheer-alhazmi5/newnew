using FormsSystem.Models.Entities;
using FormsSystem.Services;
using Microsoft.AspNetCore.Mvc;

namespace FormsSystem.Controllers;

public class NoteController : BaseController
{
    private readonly DataService _ds;
    private readonly UiHelperService _ui;

    public NoteController(DataService ds, UiHelperService ui)
    {
        _ds = ds;
        _ui = ui;
    }

    public IActionResult Index()
    {
        var auth = RequireAuth();
        if (auth != null) return auth;
        SetViewBagUser(_ui);
        return View();
    }

    [HttpGet]
    public async Task<IActionResult> GetNotes()
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });

        var notes = await _ds.ListUserNotesByUserAsync(CurrentUserId);
        var data = notes
            .OrderByDescending(n => n.IsPinned)
            .ThenByDescending(n => n.UpdatedAt ?? n.CreatedAt)
            .Select(n => MapNote(n))
            .ToList();

        return Json(new { success = true, data });
    }

    [HttpGet]
    public async Task<IActionResult> GetNote(int id)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        var n = await _ds.GetUserNoteByIdAsync(id);
        if (n == null || n.UserId != CurrentUserId)
            return Json(new { success = false, message = "غير موجود" });
        return Json(new { success = true, data = MapNote(n) });
    }

    [HttpPost]
    public async Task<IActionResult> AddNote([FromBody] UserNoteRequest req)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        var err = ValidateNote(req);
        if (err != null) return Json(new { success = false, message = err });

        var importance = DataService.NormalizeNoteImportance(req.Importance);
        var color = string.IsNullOrWhiteSpace(req.Color)
            ? DataService.DefaultNoteColor(importance)
            : req.Color!.Trim();

        var note = new UserNote
        {
            UserId = CurrentUserId,
            Title = req.Title!.Trim(),
            ContentHtml = req.ContentHtml ?? "",
            Importance = importance,
            Color = color,
            IsPinned = req.IsPinned,
            IsArchived = false,
            CreatedAt = DateTime.UtcNow
        };

        await _ds.AddUserNoteAsync(note);
        await _ds.AddAuditLogAsync(BuildAuditEntry("إضافة ملاحظة", "UserNote", note.Id.ToString(), note.Title));
        return Json(new { success = true, message = "تم حفظ الملاحظة", data = MapNote(note) });
    }

    [HttpPost]
    public async Task<IActionResult> UpdateNote([FromBody] UserNoteUpdateRequest req)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        var n = await _ds.GetUserNoteByIdAsync(req.Id);
        if (n == null || n.UserId != CurrentUserId)
            return Json(new { success = false, message = "غير موجود" });

        var err = ValidateNote(req);
        if (err != null) return Json(new { success = false, message = err });

        n.Title = req.Title!.Trim();
        n.ContentHtml = req.ContentHtml ?? "";
        n.Importance = DataService.NormalizeNoteImportance(req.Importance);
        n.Color = string.IsNullOrWhiteSpace(req.Color)
            ? DataService.DefaultNoteColor(n.Importance)
            : req.Color!.Trim();
        n.IsPinned = req.IsPinned;

        await _ds.UpdateUserNoteAsync(n);
        await _ds.AddAuditLogAsync(BuildAuditEntry("تحديث ملاحظة", "UserNote", n.Id.ToString(), n.Title));
        return Json(new { success = true, message = "تم تحديث الملاحظة", data = MapNote(n) });
    }

    [HttpPost]
    public async Task<IActionResult> DeleteNote([FromBody] UserNoteIdRequest req)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        var n = await _ds.GetUserNoteByIdAsync(req.Id);
        if (n == null || n.UserId != CurrentUserId)
            return Json(new { success = false, message = "غير موجود" });

        await _ds.DeleteUserNoteAsync(req.Id);
        await _ds.AddAuditLogAsync(BuildAuditEntry("حذف ملاحظة", "UserNote", req.Id.ToString(), n.Title));
        return Json(new { success = true, message = "تم حذف الملاحظة" });
    }

    [HttpPost]
    public async Task<IActionResult> TogglePin([FromBody] UserNoteIdRequest req)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        var n = await _ds.GetUserNoteByIdAsync(req.Id);
        if (n == null || n.UserId != CurrentUserId)
            return Json(new { success = false, message = "غير موجود" });

        await _ds.ToggleUserNotePinAsync(req.Id);
        var updated = await _ds.GetUserNoteByIdAsync(req.Id);
        return Json(new { success = true, isPinned = updated!.IsPinned });
    }

    [HttpPost]
    public async Task<IActionResult> ToggleArchive([FromBody] UserNoteIdRequest req)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        var n = await _ds.GetUserNoteByIdAsync(req.Id);
        if (n == null || n.UserId != CurrentUserId)
            return Json(new { success = false, message = "غير موجود" });

        await _ds.ToggleUserNoteArchiveAsync(req.Id);
        var updated = await _ds.GetUserNoteByIdAsync(req.Id);
        return Json(new { success = true, isArchived = updated!.IsArchived });
    }

    private static string? ValidateNote(UserNoteRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Title)) return "عنوان الملاحظة مطلوب";
        if (req.Title.Trim().Length > 200) return "عنوان الملاحظة طويل جداً";
        if (IsNoteContentEmpty(req.ContentHtml)) return "نص الملاحظة مطلوب";
        return null;
    }

    private static bool IsNoteContentEmpty(string? contentHtml)
    {
        if (string.IsNullOrWhiteSpace(contentHtml)) return true;
        var text = System.Text.RegularExpressions.Regex.Replace(contentHtml, "<[^>]+>", " ")
            .Replace("&nbsp;", " ", StringComparison.OrdinalIgnoreCase)
            .Trim();
        return string.IsNullOrWhiteSpace(text);
    }

    private static object MapNote(UserNote n) => new
    {
        n.Id,
        n.Title,
        n.ContentHtml,
        n.Importance,
        n.Color,
        n.IsPinned,
        n.IsArchived,
        CreatedAt = n.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
        UpdatedAt = (n.UpdatedAt ?? n.CreatedAt).ToString("yyyy-MM-dd HH:mm")
    };
}

public class UserNoteRequest
{
    public string? Title { get; set; }
    public string? ContentHtml { get; set; }
    public string? Importance { get; set; }
    public string? Color { get; set; }
    public bool IsPinned { get; set; }
}

public class UserNoteUpdateRequest : UserNoteRequest
{
    public int Id { get; set; }
}

public class UserNoteIdRequest
{
    public int Id { get; set; }
}
