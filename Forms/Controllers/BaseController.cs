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
}
