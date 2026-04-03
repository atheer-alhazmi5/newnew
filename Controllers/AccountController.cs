using FormsSystem.Models.Entities;
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
        var ip = GetClientIp();
        var browser = GetBrowserName();
        var os = GetClientOS();

        bool ldapOk = _ldap.IsEnabled && _ldap.Authenticate(username, password);
        var user = await _ds.GetUserByUsernameAsync(username);

        if (user == null && !ldapOk)
        {
            var attemptsByIp = (await _ds.CountRecentAttemptsByIpAsync(ip, 1, includeSuccess: false)) + 1;
            var severity = DetermineSeverity("محاولة اختراق", attemptsByIp);
            await _ds.AddLoginAttemptAsync(new LoginAttempt
            {
                UsernameAttempted = username,
                WarningType = "محاولة اختراق",
                Severity = severity,
                Description = "محاولة دخول باسم مستخدم غير موجود في النظام",
                IpAddress = ip, Browser = browser, OperatingSystem = os
            });
            model.ErrorMessage = "اسم المستخدم أو كلمة المرور غير صحيحة";
            return View(model);
        }

        if (ldapOk && user == null)
        {
            var attemptsByIp = (await _ds.CountRecentAttemptsByIpAsync(ip, 1, includeSuccess: false)) + 1;
            var severity = DetermineSeverity("محاولة اختراق", attemptsByIp);
            await _ds.AddLoginAttemptAsync(new LoginAttempt
            {
                UsernameAttempted = username,
                WarningType = "محاولة اختراق",
                Severity = severity,
                Description = "مستخدم LDAP غير مسجل في النظام",
                IpAddress = ip, Browser = browser, OperatingSystem = os
            });
            model.ErrorMessage = "المستخدم غير موجود في النظام. يرجى التواصل مع المشرف.";
            return View(model);
        }

        if (user!.Status == Models.Enums.AccountStatus.Inactive)
        {
            var attemptsByIp = (await _ds.CountRecentAttemptsByIpAsync(ip, 1, includeSuccess: false)) + 1;
            var severity = DetermineSeverity("حساب معطل", attemptsByIp);
            await _ds.AddLoginAttemptAsync(new LoginAttempt
            {
                UsernameAttempted = username,
                NationalId = user.NationalId ?? "",
                FullName = user.FullName,
                OrganizationalUnit = user.Department?.Name ?? "",
                WarningType = "حساب معطل",
                Severity = severity,
                Description = "محاولة دخول بحساب معطل (غير مفعل)",
                IpAddress = ip, Browser = browser, OperatingSystem = os
            });
            model.ErrorMessage = "الحساب موقوف. يرجى التواصل مع المشرف.";
            return View(model);
        }

        if (!ldapOk && !_pw.Verify(password, user.PasswordHash))
        {
            var recentFails = await _ds.CountRecentFailedAttemptsAsync(username);
            var attemptsByIp = (await _ds.CountRecentAttemptsByIpAsync(ip, 1, includeSuccess: false)) + 1;
            string warnType, warnDesc;
            if (recentFails >= 3)
            {
                warnType = "تخطى عدد المحاولات";
                warnDesc = $"المستخدم تخطى عدد المحاولات المسموحة ({recentFails + 1} محاولات فاشلة)";
            }
            else
            {
                warnType = "محاولة مرور فاشلة";
                warnDesc = "محاولة دخول بكلمة مرور خاطئة";
            }
            var severity = DetermineSeverity(warnType, attemptsByIp, recentFails + 1);

            await _ds.AddLoginAttemptAsync(new LoginAttempt
            {
                UsernameAttempted = username,
                NationalId = user.NationalId ?? "",
                FullName = user.FullName,
                OrganizationalUnit = user.Department?.Name ?? "",
                WarningType = warnType,
                Severity = severity,
                Description = warnDesc,
                IpAddress = ip, Browser = browser, OperatingSystem = os
            });
            model.ErrorMessage = "اسم المستخدم أو كلمة المرور غير صحيحة";
            return View(model);
        }

        await _ds.AddLoginAttemptAsync(new LoginAttempt
        {
            UsernameAttempted = username,
            NationalId = user.NationalId ?? "",
            FullName = user.FullName,
            OrganizationalUnit = user.Department?.Name ?? "",
            WarningType = "محاولة دخول ناجحة",
            Severity = "Low",
            Description = "تسجيل دخول ناجح",
            IpAddress = ip, Browser = browser, OperatingSystem = os
        });

        HttpContext.Session.SetInt32("UserId", user.Id);
        HttpContext.Session.SetString("UserName", user.Username);
        HttpContext.Session.SetString("UserFullName", user.FullName);
        HttpContext.Session.SetString("UserRole", user.RoleName);
        HttpContext.Session.SetInt32("DepartmentId", user.DepartmentId);
        HttpContext.Session.SetString("DepartmentName", user.Department?.Name ?? "");
        HttpContext.Session.SetString("UserNationalId", user.NationalId ?? "");

        await _ds.AddAuditLogAsync(new AuditLog
        {
            UserId = user.Id,
            UserName = user.FullName,
            NationalId = user.NationalId ?? "",
            OrganizationalUnit = user.Department?.Name ?? "",
            Action = "تسجيل دخول",
            EntityType = "User",
            EntityId = user.Id.ToString(),
            IpAddress = ip, Browser = browser, OperatingSystem = os
        });

        return RedirectAfterLogin(user.RoleName);
    }

    [HttpPost]
    public async Task<IActionResult> Logout()
    {
        if (IsAuthenticated)
        {
            await _ds.AddAuditLogAsync(BuildAuditEntry("تسجيل خروج", "User", CurrentUserId.ToString()));
        }
        HttpContext.Session.Clear();
        return RedirectToAction("Landing");
    }

    [HttpGet]
    public IActionResult AccessDenied() => View();

    private static string DetermineSeverity(string warningType, int attemptsByIpLastMinute, int attemptsByUsernameWindow = 0)
    {
        if (warningType == "محاولة دخول ناجحة")
            return "Low";

        if (attemptsByIpLastMinute >= 20)
            return "Critical";
        if (attemptsByIpLastMinute >= 10)
            return "High";

        return warningType switch
        {
            "محاولة اختراق" => attemptsByIpLastMinute >= 5 ? "Medium" : "Low",
            "تخطى عدد المحاولات" => (attemptsByIpLastMinute >= 5 || attemptsByUsernameWindow >= 8) ? "High" : "Medium",
            "محاولة مرور فاشلة" => (attemptsByIpLastMinute >= 5 || attemptsByUsernameWindow >= 4) ? "Medium" : "Low",
            "حساب معطل" => attemptsByIpLastMinute >= 4 ? "Medium" : "Low",
            _ => "Low"
        };
    }

    private IActionResult RedirectAfterLogin(string role) => role switch
    {
        "Manager" => RedirectToAction("Index", "Dashboard"),
        "Staff" => RedirectToAction("Index", "Inbox"),
        _ => RedirectToAction("Index", "Forms")
    };
}
