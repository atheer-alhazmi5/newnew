using FormsSystem.Services;
using Microsoft.AspNetCore.Mvc;

namespace FormsSystem.Controllers;

public class DashboardController : BaseController
{
    private readonly DataService _ds;
    private readonly UiHelperService _ui;

    public DashboardController(DataService ds, UiHelperService ui) { _ds = ds; _ui = ui; }

    public async Task<IActionResult> Index()
    {
        var auth = RequireAuth(); if (auth != null) return auth;
        if (CurrentUserRole != "Manager" && CurrentUserRole != "Admin")
            return RedirectToAction("Index", "Forms");

        SetViewBagUser(_ui);
        var kpis = await _ds.GetDashboardKpisAsync(CurrentUserId, CurrentDeptId);
        ViewBag.Approved = kpis.approved;
        ViewBag.Sent = kpis.sent;
        ViewBag.Pending = kpis.pending;
        ViewBag.Inbox = kpis.inbox;
        ViewBag.RecentLogs = await _ds.ListRecentAuditLogsAsync(10);
        return View();
    }

    [HttpGet]
    public async Task<IActionResult> GetKpis()
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        var kpis = await _ds.GetDashboardKpisAsync(CurrentUserId, CurrentDeptId);
        return Json(new { success = true, data = new { kpis.approved, kpis.sent, kpis.pending, kpis.inbox } });
    }
}
