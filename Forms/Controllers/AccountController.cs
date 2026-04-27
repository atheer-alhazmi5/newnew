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
        HttpContext.Session.SetInt32("DepartmentId", user.DepartmentId ?? 0);
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

        if (await UserHasActiveIncomingDelegationAsync(user))
            return RedirectToAction("SelectAccount");

        return RedirectAfterLogin(user.RoleName);
    }

    private async Task<bool> UserHasActiveIncomingDelegationAsync(User user)
    {
        var bens = await _ds.ListBeneficiariesAsync();
        var ben = bens.FirstOrDefault(b =>
            (!string.IsNullOrEmpty(user.NationalId) && b.NationalId == user.NationalId) ||
            (!string.IsNullOrEmpty(b.Username) && string.Equals(b.Username, user.Username, StringComparison.OrdinalIgnoreCase)));
        if (ben == null) return false;
        var delegations = await _ds.ListDelegationsAsync();
        var today = DateTime.Today;
        return delegations.Any(d =>
            d.DelegateeBeneficiaryId == ben.Id &&
            d.Status != "cancelled" && d.Status != "draft" &&
            d.StartDate.Date <= today && d.EndDate.Date >= today);
    }

    [HttpGet]
    public async Task<IActionResult> SelectAccount()
    {
        if (!IsAuthenticated)
            return RedirectToAction("Login");

        var bens = await _ds.ListBeneficiariesAsync();
        var ben = bens.FirstOrDefault(b =>
            (!string.IsNullOrEmpty(CurrentUserNationalId) && b.NationalId == CurrentUserNationalId) ||
            (!string.IsNullOrEmpty(b.Username) && string.Equals(b.Username, CurrentUserName, StringComparison.OrdinalIgnoreCase)));
        if (ben == null)
            return RedirectAfterLogin(CurrentUserRole);

        var delegations = await _ds.ListDelegationsAsync();
        var units = await _ds.ListOrganizationalUnitsAsync();
        var today = DateTime.Today;
        var active = delegations.Where(d =>
            d.DelegateeBeneficiaryId == ben.Id &&
            d.Status != "cancelled" && d.Status != "draft" &&
            d.StartDate.Date <= today && d.EndDate.Date >= today).ToList();

        if (!active.Any())
            return RedirectAfterLogin(CurrentUserRole);

        var benById = bens.ToDictionary(b => b.Id);
        var unitById = units.ToDictionary(u => u.Id);
        var options = active.Select(d =>
        {
            benById.TryGetValue(d.DelegatorBeneficiaryId, out var dor);
            unitById.TryGetValue(d.DelegatorOrgUnitId, out var dorU);
            return new DelegationChoiceVm
            {
                DelegationId = d.Id,
                DelegatorName = dor?.FullName ?? "",
                DelegatorUnitName = dorU?.Name ?? "",
                StartDate = d.StartDate.ToString("yyyy-MM-dd"),
                EndDate = d.EndDate.ToString("yyyy-MM-dd")
            };
        }).ToList();

        ViewBag.OwnFullName = CurrentUserFullName;
        ViewBag.OwnDeptName = CurrentDeptName;
        ViewBag.Options = options;
        return View();
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> SelectAccount(string choice, int? delegationId)
    {
        if (!IsAuthenticated)
            return RedirectToAction("Login");

        if (choice == "self")
            return RedirectAfterLogin(CurrentUserRole);

        if (choice == "delegator" && delegationId.HasValue)
        {
            var d = await _ds.GetDelegationByIdAsync(delegationId.Value);
            if (d == null)
                return RedirectAfterLogin(CurrentUserRole);

            var bens = await _ds.ListBeneficiariesAsync();
            var meBen = bens.FirstOrDefault(b =>
                (!string.IsNullOrEmpty(CurrentUserNationalId) && b.NationalId == CurrentUserNationalId) ||
                (!string.IsNullOrEmpty(b.Username) && string.Equals(b.Username, CurrentUserName, StringComparison.OrdinalIgnoreCase)));
            if (meBen == null || d.DelegateeBeneficiaryId != meBen.Id)
                return RedirectAfterLogin(CurrentUserRole);

            var today = DateTime.Today;
            var stillActive = d.Status != "cancelled" && d.Status != "draft" &&
                              d.StartDate.Date <= today && d.EndDate.Date >= today;
            if (!stillActive)
                return RedirectAfterLogin(CurrentUserRole);

            var dorBen = bens.FirstOrDefault(b => b.Id == d.DelegatorBeneficiaryId);
            User? dorUser = null;
            if (dorBen != null)
            {
                if (!string.IsNullOrEmpty(dorBen.Username))
                    dorUser = await _ds.GetUserByUsernameAsync(dorBen.Username.Trim());
            }
            if (dorUser == null)
                return RedirectAfterLogin(CurrentUserRole);

            var impersonatorFullName = CurrentUserFullName;
            var impersonatorUserId = CurrentUserId;

            HttpContext.Session.SetInt32("ImpersonatorUserId", impersonatorUserId);
            HttpContext.Session.SetString("ImpersonatorFullName", impersonatorFullName);
            HttpContext.Session.SetInt32("DelegationId", d.Id);

            HttpContext.Session.SetInt32("UserId", dorUser.Id);
            HttpContext.Session.SetString("UserName", dorUser.Username);
            HttpContext.Session.SetString("UserFullName", dorUser.FullName);
            HttpContext.Session.SetString("UserRole", dorUser.RoleName);
            HttpContext.Session.SetInt32("DepartmentId", dorUser.DepartmentId ?? 0);
            HttpContext.Session.SetString("DepartmentName", dorUser.Department?.Name ?? "");
            HttpContext.Session.SetString("UserNationalId", dorUser.NationalId ?? "");

            await _ds.AddAuditLogAsync(new AuditLog
            {
                UserId = dorUser.Id,
                UserName = dorUser.FullName,
                NationalId = dorUser.NationalId ?? "",
                OrganizationalUnit = dorUser.Department?.Name ?? "",
                Action = "الدخول بصلاحية تفويض",
                EntityType = "Delegation",
                EntityId = d.Id.ToString(),
                Details = $"تم الدخول بحساب المفوّض بواسطة {impersonatorFullName}",
                IpAddress = GetClientIp(),
                Browser = GetBrowserName(),
                OperatingSystem = GetClientOS()
            });

            return RedirectAfterLogin(dorUser.RoleName);
        }

        return RedirectAfterLogin(CurrentUserRole);
    }

    public class DelegationChoiceVm
    {
        public int DelegationId { get; set; }
        public string DelegatorName { get; set; } = "";
        public string DelegatorUnitName { get; set; } = "";
        public string StartDate { get; set; } = "";
        public string EndDate { get; set; } = "";
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
