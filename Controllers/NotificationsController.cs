using FormsSystem.Services;
using Microsoft.AspNetCore.Mvc;

namespace FormsSystem.Controllers;

public class NotificationsController : BaseController
{
    private readonly DataService _ds;
    private readonly UiHelperService _ui;

    public NotificationsController(DataService ds, UiHelperService ui) { _ds = ds; _ui = ui; }

    public IActionResult Index()
    {
        var auth = RequireAuth(); if (auth != null) return auth;
        SetViewBagUser(_ui);
        return View();
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(string? type)
    {
        if (!IsAuthenticated) return Json(new { success = false });
        var notifs = await _ds.ListNotificationsAsync(CurrentUserId);
        if (!string.IsNullOrEmpty(type))
            notifs = notifs.Where(n => n.Type == type).ToList();

        return Json(new
        {
            success = true,
            data = notifs.Select(n => new
            {
                n.Id, n.FormId, n.FormName, n.Type, n.Title, n.Message,
                n.SenderName, n.SenderDepartment, n.IsRead, n.CreatedAt
            }),
            unreadCount = notifs.Count(n => !n.IsRead)
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetUnreadCount()
    {
        if (!IsAuthenticated) return Json(new { success = false });
        var count = await _ds.GetUnreadCountAsync(CurrentUserId);
        return Json(new { success = true, count });
    }

    [HttpPost]
    public async Task<IActionResult> MarkRead(int id)
    {
        if (!IsAuthenticated) return Json(new { success = false });
        await _ds.MarkNotificationReadAsync(id);
        return Json(new { success = true });
    }

    [HttpPost]
    public async Task<IActionResult> MarkAllRead()
    {
        if (!IsAuthenticated) return Json(new { success = false });
        await _ds.MarkAllNotificationsReadAsync(CurrentUserId);
        return Json(new { success = true });
    }

    [HttpDelete]
    public async Task<IActionResult> Delete(int id)
    {
        if (!IsAuthenticated) return Json(new { success = false });
        await _ds.DeleteNotificationAsync(id);
        return Json(new { success = true });
    }
}
