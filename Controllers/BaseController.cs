using FormsSystem.Models.Entities;
using FormsSystem.Models.Enums;
using FormsSystem.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace FormsSystem.Controllers;

public abstract class BaseController : Controller
{
    protected int CurrentUserId => HttpContext.Session.GetInt32("UserId") ?? 0;
    protected string CurrentUserName => HttpContext.Session.GetString("UserName") ?? "";
    protected string CurrentUserFullName => HttpContext.Session.GetString("UserFullName") ?? "";
    protected string CurrentUserRole => HttpContext.Session.GetString("UserRole") ?? "";
    protected int CurrentDeptId => HttpContext.Session.GetInt32("DepartmentId") ?? 0;
    protected string CurrentDeptName => HttpContext.Session.GetString("DepartmentName") ?? "";
    protected string CurrentUserNationalId => HttpContext.Session.GetString("UserNationalId") ?? "";

    protected bool IsAuthenticated => CurrentUserId > 0;

    protected IActionResult RequireAuth()
    {
        if (!IsAuthenticated)
            return RedirectToAction("Login", "Account");
        return null!;
    }

    protected void SetViewBagUser(UiHelperService ui)
    {
        ViewBag.UserId = CurrentUserId;
        ViewBag.UserName = CurrentUserName;
        ViewBag.UserFullName = CurrentUserFullName;
        ViewBag.UserRole = CurrentUserRole;
        ViewBag.DeptId = CurrentDeptId;
        ViewBag.DeptName = CurrentDeptName;
        ViewBag.HijriDate = ui.GetCurrentHijriDate();
        ViewBag.CurrentTime = ui.GetCurrentTime();
    }

    protected string GetClientIp()
    {
        var forwarded = HttpContext.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrEmpty(forwarded))
            return forwarded.Split(',')[0].Trim();
        return HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "";
    }

    protected string GetBrowserName()
    {
        var ua = Request.Headers["User-Agent"].ToString();
        if (string.IsNullOrEmpty(ua)) return "غير معروف";
        if (ua.Contains("Edg")) return "Edge";
        if (ua.Contains("OPR") || ua.Contains("Opera")) return "Opera";
        if (ua.Contains("Chrome")) return "Chrome";
        if (ua.Contains("Firefox")) return "Firefox";
        if (ua.Contains("Safari")) return "Safari";
        return "غير معروف";
    }

    protected string GetClientOS()
    {
        var ua = Request.Headers["User-Agent"].ToString();
        if (string.IsNullOrEmpty(ua)) return "غير معروف";
        if (ua.Contains("Windows NT 10")) return "Windows";
        if (ua.Contains("Windows")) return "Windows";
        if (ua.Contains("Macintosh") || ua.Contains("Mac OS")) return "macOS";
        if (ua.Contains("Android")) return "Android";
        if (ua.Contains("iPhone") || ua.Contains("iPad")) return "iOS";
        if (ua.Contains("Linux")) return "Linux";
        return "غير معروف";
    }

    protected AuditLog BuildAuditEntry(string action, string entityType, string entityId, string details = "")
    {
        return new AuditLog
        {
            UserId = CurrentUserId,
            UserName = CurrentUserFullName,
            NationalId = CurrentUserNationalId,
            OrganizationalUnit = CurrentDeptName,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            Details = details,
            IpAddress = GetClientIp(),
            Browser = GetBrowserName(),
            OperatingSystem = GetClientOS()
        };
    }
}
