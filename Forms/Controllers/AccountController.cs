using FormsSystem.Models.ViewModels;
using FormsSystem.Services;
using Microsoft.AspNetCore.Mvc;

namespace FormsSystem.Controllers;

public class AccountController : BaseController
{
    private readonly DataService _ds;
    private readonly PasswordService _pw;
    private readonly LdapService _ldap;
    private readonly UiHelperService _ui;

    public AccountController(DataService ds, PasswordService pw, LdapService ldap, UiHelperService ui)
    {
        _ds = ds; _pw = pw; _ldap = ldap; _ui = ui;
    }

    [HttpGet]
    public IActionResult Landing()
    {
        if (IsAuthenticated)
            return RedirectAfterLogin(CurrentUserRole);
        return View();
    }

    [HttpGet]
    public IActionResult Login()
    {
        if (IsAuthenticated)
            return RedirectAfterLogin(CurrentUserRole);
        return View(new LoginVm());
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Login(LoginVm model)
    {
        if (!ModelState.IsValid)
            return View(model);

        var username = model.Username.Trim().ToLower();
        var password = model.Password;

        // Try LDAP first
        bool ldapOk = _ldap.IsEnabled && _ldap.Authenticate(username, password);

        var user = await _ds.GetUserByUsernameAsync(username);

        if (ldapOk && user == null)
        {
            model.ErrorMessage = "المستخدم غير موجود في النظام. يرجى التواصل مع المشرف.";
            return View(model);
        }

        if (!ldapOk)
        {
            // Local auth
            if (user == null || !_pw.Verify(password, user.PasswordHash))
            {
                model.ErrorMessage = "اسم المستخدم أو كلمة المرور غير صحيحة";
                return View(model);
            }
        }

        if (user!.Status == Models.Enums.AccountStatus.Inactive)
        {
            model.ErrorMessage = "الحساب موقوف. يرجى التواصل مع المشرف.";
            return View(model);
        }

        // Set session
        HttpContext.Session.SetInt32("UserId", user.Id);
        HttpContext.Session.SetString("UserName", user.Username);
        HttpContext.Session.SetString("UserFullName", user.FullName);
        HttpContext.Session.SetString("UserRole", user.RoleName);
        HttpContext.Session.SetInt32("DepartmentId", user.DepartmentId);
        HttpContext.Session.SetString("DepartmentName", user.Department?.Name ?? "");

        await _ds.AddAuditLogAsync(user.Id, user.FullName, "تسجيل دخول", "User", user.Id.ToString());

        return RedirectAfterLogin(user.RoleName);
    }

    [HttpPost]
    public IActionResult Logout()
    {
        HttpContext.Session.Clear();
        return RedirectToAction("Landing");
    }

    [HttpGet]
    public IActionResult AccessDenied() => View();

    private IActionResult RedirectAfterLogin(string role) => role switch
    {
        "Manager" => RedirectToAction("Index", "Dashboard"),
        "Staff" => RedirectToAction("Index", "Inbox"),
        _ => RedirectToAction("Index", "Forms") // Admin + Employee
    };
}
