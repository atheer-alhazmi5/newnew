using FormsSystem.Models.Entities;
using FormsSystem.Models.Enums;
using FormsSystem.Services;
using Microsoft.AspNetCore.Mvc;

namespace FormsSystem.Controllers;

public class UsersController : BaseController
{
    private readonly DataService _ds;
    private readonly PasswordService _pw;
    private readonly UiHelperService _ui;

    public UsersController(DataService ds, PasswordService pw, UiHelperService ui)
    { _ds = ds; _pw = pw; _ui = ui; }

    public IActionResult Index()
    {
        var auth = RequireAuth(); if (auth != null) return auth;
        if (CurrentUserRole == "Staff" || CurrentUserRole == "Employee")
            return RedirectToAction("Index", "Forms");
        SetViewBagUser(_ui);
        return View();
    }

    [HttpGet]
    public async Task<IActionResult> GetUsers(int? deptId, string? role)
    {
        if (!IsAuthenticated) return Json(new { success = false });
        int? filterDept = CurrentUserRole == "Manager" ? CurrentDeptId : deptId;
        var users = await _ds.ListUsersAsync(filterDept);

        if (CurrentUserRole == "Manager")
        {
            users = users.Where(u =>
                u.DepartmentId == CurrentDeptId &&
                u.Id != CurrentUserId &&
                (u.Role == UserRole.Employee || u.Role == UserRole.Staff)).ToList();
        }

        if (!string.IsNullOrEmpty(role) && Enum.TryParse<UserRole>(role, out var r))
            users = users.Where(u => u.Role == r).ToList();

        return Json(new
        {
            success = true,
            data = users.Select(u => new
            {
                u.Id, u.Username, u.FullName, u.Email,
                u.Phone, u.NationalId, u.PhotoUrl,
                u.RoleLabel, Role = u.RoleName,
                DeptName = u.Department?.Name,
                u.DepartmentId, u.Status,
                StatusLabel = u.Status == AccountStatus.Active ? "نشط" : "موقوف"
            })
        });
    }

    [HttpGet]
    public async Task<IActionResult> LookupByNationalId(string nationalId)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        if (string.IsNullOrWhiteSpace(nationalId))
            return Json(new { success = false, message = "رقم الهوية مطلوب" });

        var existingUsers = await _ds.ListUsersAsync();
        if (existingUsers.Any(u => (u.NationalId ?? "") == nationalId.Trim()))
            return Json(new { success = false, message = "رقم الهوية مسجل مسبقاً في النظام" });

        var result = await _ds.LookupDirectoryByNationalIdAsync(nationalId.Trim());
        if (result == null)
            return Json(new { success = false, message = "لم يتم العثور على الهوية   " });

        int? deptId = null;
        var depts = await _ds.ListDepartmentsAsync();
        var matchDept = depts.FirstOrDefault(d => d.Name == result.DepartmentName);
        if (matchDept != null) deptId = matchDept.Id;

        return Json(new
        {
            success = true,
            data = new
            {
                result.NationalId,
                result.FullName,
                result.Email,
                result.Phone,
                result.PhotoUrl,
                DepartmentName = result.DepartmentName,
                DepartmentId = deptId
            }
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetDepartments()
    {
        if (!IsAuthenticated) return Json(new { success = false });
        var depts = await _ds.ListDepartmentsAsync();
        return Json(new { success = true, data = depts.Select(d => new { d.Id, d.Name }) });
    }

    [HttpPost]
    public async Task<IActionResult> AddUser([FromBody] AddUserRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        if (string.IsNullOrWhiteSpace(req.Username))
            return Json(new { success = false, errors = new { username = new[] { "اسم المستخدم مطلوب" } } });
        if (string.IsNullOrWhiteSpace(req.NationalId))
            return Json(new { success = false, message = "رقم الهوية مطلوب" });

        var existing = await _ds.GetUserByUsernameAsync(req.Username.ToLower());
        if (existing != null)
            return Json(new { success = false, message = "اسم المستخدم موجود مسبقاً" });

        var allUsers = await _ds.ListUsersAsync();
        if (allUsers.Any(u => (u.NationalId ?? "") == req.NationalId.Trim()))
            return Json(new { success = false, message = "رقم الهوية موجود مسبقاً" });

        var user = new User
        {
            NationalId = req.NationalId.Trim(),
            Username = req.Username.ToLower(),
            FullName = req.FullName,
            Email = req.Email ?? "",
            Phone = req.Phone ?? "",
            PhotoUrl = req.PhotoUrl ?? "",
            PasswordHash = _pw.Hash(req.Password ?? "password123"),
            Role = Enum.Parse<UserRole>(req.Role ?? "Employee"),
            DepartmentId = req.DepartmentId,
            Status = req.IsActive ? AccountStatus.Active : AccountStatus.Inactive
        };
        await _ds.AddUserAsync(user);
        await _ds.AddAuditLogAsync(BuildAuditEntry("إضافة مستخدم", "User", user.Id.ToString(), user.FullName));
        return Json(new { success = true, message = "تم إضافة المستخدم بنجاح" });
    }

    [HttpPost]
    public async Task<IActionResult> ToggleStatus(int userId)
    {
        if (!IsAuthenticated) return Json(new { success = false });
        var u = await _ds.GetUserByIdAsync(userId);
        if (u == null) return Json(new { success = false });

        if (u.Id == CurrentUserId)
            return Json(new { success = false, message = "لا يمكنك تعديل حالتك الخاصة" });

        if (CurrentUserRole == "Manager")
        {
            if (u.DepartmentId != CurrentDeptId ||
                (u.Role != UserRole.Employee && u.Role != UserRole.Staff))
                return Json(new { success = false, message = "غير مصرح" });
        }

        var newStatus = u.Status == AccountStatus.Active ? AccountStatus.Inactive : AccountStatus.Active;
        await _ds.UpdateUserStatusAsync(userId, newStatus);
        await _ds.AddAuditLogAsync(BuildAuditEntry(newStatus == FormsSystem.Models.Enums.AccountStatus.Active ? "تفعيل مستخدم" : "تعطيل مستخدم", "User", u.Id.ToString(), u.FullName));
        return Json(new { success = true, newStatus = newStatus.ToString() });
    }

    [HttpPost]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var u = await _ds.GetUserByIdAsync(req.UserId);
        if (u == null) return Json(new { success = false });
        u.PasswordHash = _pw.Hash(req.NewPassword ?? "password123");
        await _ds.UpdateUserAsync(u);
        return Json(new { success = true, message = "تم تغيير كلمة المرور" });
    }

    [HttpPost]
    public async Task<IActionResult> UpdateRole([FromBody] UpdateRoleRequest req)
    {
        if (!IsAuthenticated || (CurrentUserRole != "Admin" && CurrentUserRole != "Manager"))
            return Json(new { success = false, message = "غير مصرح" });

        var u = await _ds.GetUserByIdAsync(req.UserId);
        if (u == null) return Json(new { success = false, message = "المستخدم غير موجود" });

        if (u.Id == CurrentUserId)
            return Json(new { success = false, message = "لا يمكنك تعديل دورك الخاص" });

        if (!Enum.TryParse<UserRole>(req.Role, out var newRole))
            return Json(new { success = false, message = "الدور غير صالح" });

        if (CurrentUserRole == "Manager")
        {
            if (u.DepartmentId != CurrentDeptId)
                return Json(new { success = false, message = "غير مصرح" });

            if (u.Role != UserRole.Employee && u.Role != UserRole.Staff)
                return Json(new { success = false, message = "يمكنك فقط إدارة المستخدمين التابعين لك" });

            if (newRole != UserRole.Employee && newRole != UserRole.Staff)
                return Json(new { success = false, message = "يمكنك التبديل بين موظف وممثل وحدة تنظيمية فقط" });

            if (req.DepartmentId > 0 && req.DepartmentId != CurrentDeptId)
                return Json(new { success = false, message = "لا يمكنك نقل المستخدم لقسم آخر" });
        }

        u.Role = newRole;
        if (req.DepartmentId > 0)
            u.DepartmentId = req.DepartmentId;

        await _ds.UpdateUserAsync(u);
        await _ds.AddAuditLogAsync(BuildAuditEntry("تعديل دور مستخدم", "User", u.Id.ToString(), $"{u.FullName} -> {u.RoleLabel}"));

        return Json(new { success = true, message = "تم تعديل المستخدم بنجاح" });
    }
}

public class AddUserRequest
{
    public string NationalId { get; set; } = "";
    public string Username { get; set; } = "";
    public string FullName { get; set; } = "";
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? PhotoUrl { get; set; }
    public string? Password { get; set; }
    public string? Role { get; set; }
    public int DepartmentId { get; set; }
    public bool IsActive { get; set; } = true;
}

public class ResetPasswordRequest
{
    public int UserId { get; set; }
    public string? NewPassword { get; set; }
}

public class UpdateRoleRequest
{
    public int UserId { get; set; }
    public string Role { get; set; } = "";
    public int DepartmentId { get; set; }
}
