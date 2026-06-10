using FormsSystem.Models.Entities;
using FormsSystem.Services;
using Microsoft.AspNetCore.Mvc;

namespace FormsSystem.Controllers;

public class ExecutorRolesController : BaseController
{
    private readonly DataService _ds;
    private readonly UiHelperService _ui;

    public ExecutorRolesController(DataService ds, UiHelperService ui)
    {
        _ds = ds;
        _ui = ui;
    }

    private static bool HasAtLeastOneExecutorId(string? executorIds)
    {
        if (string.IsNullOrWhiteSpace(executorIds)) return false;
        foreach (var p in executorIds.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            if (int.TryParse(p, out var n) && n > 0) return true;
        return false;
    }

    public IActionResult Index()
    {
        var auth = RequireAuth();
        if (auth != null) return auth;
        if (CurrentUserRole != "Admin")
            return RedirectToAction("Index", "Forms");
        SetViewBagUser(_ui);
        ViewBag.PageName = "أدوار المنفذين";
        return View();
    }

    [HttpGet]
    public async Task<IActionResult> GetExecutorRoles(string? search, string? ownership, int? orgUnitId, string? isActive)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var all = await _ds.ListExecutorRolesAsync();
        var units = await _ds.ListOrganizationalUnitsAsync();
        var activeUnits = units.Where(u => u.IsActive).OrderBy(u => u.SortOrder).ToList();
        var beneficiaries = await _ds.ListBeneficiariesAsync();
        var ouMap = units.ToDictionary(u => u.Id, u => u.Name);

        var filtered = all.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            filtered = filtered.Where(r => (r.Name?.ToLower().Contains(s) ?? false) || (r.Description?.ToLower().Contains(s) ?? false));
        }
        if (!string.IsNullOrWhiteSpace(ownership))
            filtered = filtered.Where(r => r.Ownership == ownership);
        if (orgUnitId.HasValue && orgUnitId.Value > 0)
            filtered = filtered.Where(r => r.OrgUnitIds.Split(',', StringSplitOptions.RemoveEmptyEntries).Contains(orgUnitId.Value.ToString()));
        if (!string.IsNullOrWhiteSpace(isActive))
            filtered = filtered.Where(r => r.IsActive == (isActive == "1"));

        string ResolveNames(string ids, Dictionary<int, string> map)
        {
            if (string.IsNullOrWhiteSpace(ids)) return "";
            return string.Join("، ", ids.Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(id => int.TryParse(id.Trim(), out var n) && map.TryGetValue(n, out var name) ? name : "")
                .Where(n => !string.IsNullOrEmpty(n)));
        }

        var benMap = beneficiaries.Where(b => b.IsActive).ToDictionary(b => b.Id, b => b.FullName);

        var result = filtered.Select(r => new
        {
            r.Id, r.Name, r.Description, r.Ownership,
            r.OrgUnitIds, r.ExecutorIds, r.Color,
            r.SortOrder, r.IsActive,
            DeactivateReason = r.DeactivateReason ?? "",
            OrgUnitNames = ResolveNames(r.OrgUnitIds, ouMap),
            ExecutorNames = ResolveNames(r.ExecutorIds, benMap),
            ExecutorCount = string.IsNullOrWhiteSpace(r.ExecutorIds) ? 0 : r.ExecutorIds.Split(',', StringSplitOptions.RemoveEmptyEntries).Length,
            r.CreatedBy, CreatedAt = r.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
            r.UpdatedBy, UpdatedAt = r.UpdatedAt?.ToString("yyyy-MM-dd HH:mm")
        }).OrderBy(x => x.SortOrder).ToList();

        return Json(new
        {
            success = true,
            data = result,
            organizationalUnits = activeUnits.Select(u => new { u.Id, u.Name, u.ParentId, u.SortOrder, u.Level }).ToList(),
            beneficiaries = beneficiaries.Where(b => b.IsActive).Select(b => new { b.Id, FullName = b.FullName, b.OrganizationalUnitId, b.IsUnitManager, RoleDisplay = b.RoleDisplay ?? "" }).ToList()
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetExecutorRoleDetails(int id)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var r = await _ds.GetExecutorRoleByIdAsync(id);
        if (r == null) return Json(new { success = false, message = "الدور غير موجود" });

        var units = await _ds.ListOrganizationalUnitsAsync();
        var bens = await _ds.ListBeneficiariesAsync();
        var ouMap = units.ToDictionary(u => u.Id, u => u.Name);
        var benMap = bens.ToDictionary(b => b.Id, b => b.FullName);

        string Resolve(string ids, Dictionary<int, string> map)
        {
            if (string.IsNullOrWhiteSpace(ids)) return "";
            return string.Join("، ", ids.Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(i => int.TryParse(i.Trim(), out var n) && map.TryGetValue(n, out var name) ? name : "")
                .Where(n => !string.IsNullOrEmpty(n)));
        }

        var executorIdList = (r.ExecutorIds ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(s => int.TryParse(s, out var n) ? n : (int?)null)
            .Where(n => n.HasValue)
            .Select(n => n!.Value)
            .ToList();

        var executorDetailRows = new List<object>();
        var rowNum = 1;
        foreach (var bid in executorIdList)
        {
            var ben = bens.FirstOrDefault(b => b.Id == bid);
            var fn = ben?.FullName ?? "—";
            var ouN = "—";
            if (ben?.OrganizationalUnitId is int ouid && ouMap.TryGetValue(ouid, out var ouNm))
                ouN = ouNm;
            executorDetailRows.Add(new { index = rowNum++, executorName = fn, organizationalUnitName = ouN });
        }

        return Json(new
        {
            success = true,
            data = new
            {
                r.Id, r.Name, r.Description, r.Ownership,
                r.OrgUnitIds, r.ExecutorIds, r.Color,
                r.SortOrder, r.IsActive,
                DeactivateReason = r.DeactivateReason ?? "",
                OrgUnitNames = Resolve(r.OrgUnitIds, ouMap),
                ExecutorNames = Resolve(r.ExecutorIds, benMap),
                ExecutorDetailRows = executorDetailRows,
                r.CreatedBy, CreatedAt = r.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
                r.UpdatedBy, UpdatedAt = r.UpdatedAt?.ToString("yyyy-MM-dd HH:mm")
            }
        });
    }

    [HttpPost]
    public async Task<IActionResult> AddExecutorRole([FromBody] ExecutorRoleRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });
        if (string.IsNullOrWhiteSpace(req.Name))
            return Json(new { success = false, message = "اسم الدور مطلوب" });
        if (string.IsNullOrWhiteSpace(req.OrgUnitIds))
            return Json(new { success = false, message = "يجب اختيار الوحدة التنظيمية" });
        if (!HasAtLeastOneExecutorId(req.ExecutorIds))
            return Json(new { success = false, message = "يجب اختيار المنفذين" });

        var deactivateErr = ValidateExecutorRoleDeactivateReason(req.IsActive, req.DeactivateReason);
        if (deactivateErr != null)
            return Json(new { success = false, message = deactivateErr });

        var all = await _ds.ListExecutorRolesAsync();
        var trimmedName = req.Name.Trim();
        if (all.Any(x => string.Equals((x.Name ?? "").Trim(), trimmedName, StringComparison.Ordinal)))
            return Json(new { success = false, message = "اسم الدور موجود مسبقاً" });

        var nextOrder = all.Count > 0 ? all.Max(r => r.SortOrder) + 1 : 1;

        var role = new ExecutorRole
        {
            Name = trimmedName,
            Description = req.Description?.Trim() ?? "",
            Ownership = req.Ownership ?? "حصري",
            OrgUnitIds = req.OrgUnitIds ?? "",
            ExecutorIds = req.ExecutorIds ?? "",
            Color = req.Color ?? "#25935F",
            SortOrder = nextOrder,
            IsActive = req.IsActive,
            DeactivateReason = req.IsActive ? "" : (req.DeactivateReason ?? "").Trim(),
            CreatedBy = CurrentUserFullName
        };

        await _ds.AddExecutorRoleAsync(role);
        await _ds.AddAuditLogAsync(BuildAuditEntry("إضافة دور منفذ", "ExecutorRole", role.Id.ToString(), role.Name));
        return Json(new { success = true, message = "تم إنشاء الدور بنجاح", id = role.Id });
    }

    [HttpPost]
    public async Task<IActionResult> UpdateExecutorRole([FromBody] ExecutorRoleUpdateRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var r = await _ds.GetExecutorRoleByIdAsync(req.Id);
        if (r == null) return Json(new { success = false, message = "الدور غير موجود" });
        if (string.IsNullOrWhiteSpace(req.Name))
            return Json(new { success = false, message = "اسم الدور مطلوب" });

        var allRoles = await _ds.ListExecutorRolesAsync();
        var trimmedName = req.Name.Trim();
        if (allRoles.Any(x => x.Id != req.Id && string.Equals((x.Name ?? "").Trim(), trimmedName, StringComparison.Ordinal)))
            return Json(new { success = false, message = "اسم الدور موجود مسبقاً" });
        if (!HasAtLeastOneExecutorId(req.ExecutorIds))
            return Json(new { success = false, message = "يجب اختيار المنفذين" });

        var deactivateErr = ValidateExecutorRoleDeactivateReason(req.IsActive, req.DeactivateReason);
        if (deactivateErr != null)
            return Json(new { success = false, message = deactivateErr });

        r.Name = trimmedName;
        r.Description = req.Description?.Trim() ?? "";
        r.Ownership = req.Ownership ?? r.Ownership;
        r.OrgUnitIds = req.OrgUnitIds ?? r.OrgUnitIds;
        r.ExecutorIds = req.ExecutorIds ?? r.ExecutorIds;
        r.Color = req.Color ?? r.Color;
        if (req.SortOrder > 0) r.SortOrder = req.SortOrder;
        r.IsActive = req.IsActive;
        r.DeactivateReason = req.IsActive ? "" : (req.DeactivateReason ?? "").Trim();
        r.UpdatedBy = CurrentUserFullName;
        r.UpdatedAt = DateTime.UtcNow;

        await _ds.UpdateExecutorRoleAsync(r);
        await _ds.AddAuditLogAsync(BuildAuditEntry("تحديث دور منفذ", "ExecutorRole", r.Id.ToString(), r.Name));
        return Json(new { success = true, message = "تم تحديث الدور بنجاح" });
    }

    [HttpPost]
    public async Task<IActionResult> DeleteExecutorRole([FromBody] ExecutorRoleIdRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var r = await _ds.GetExecutorRoleByIdAsync(req.Id);
        if (r == null) return Json(new { success = false, message = "الدور غير موجود" });

        if (await _ds.IsExecutorRoleLinkedAsync(req.Id))
            return Json(new { success = false, message = LinkedEntityDeleteBlockedMessage });

        await _ds.DeleteExecutorRoleAsync(req.Id);
        await _ds.AddAuditLogAsync(BuildAuditEntry("حذف دور منفذ", "ExecutorRole", req.Id.ToString(), r.Name));
        return Json(new { success = true, message = "تم حذف الدور بنجاح" });
    }

    [HttpPost]
    public async Task<IActionResult> ToggleExecutorRole([FromBody] ExecutorRoleToggleRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var r = await _ds.GetExecutorRoleByIdAsync(req.Id);
        if (r == null) return Json(new { success = false, message = "الدور غير موجود" });

        var newActive = !r.IsActive;
        if (!newActive)
        {
            var deactivateErr = ValidateExecutorRoleDeactivateReason(false, req.DeactivateReason);
            if (deactivateErr != null)
                return Json(new { success = false, message = deactivateErr });
        }

        r.IsActive = newActive;
        r.DeactivateReason = newActive ? "" : (req.DeactivateReason ?? "").Trim();
        r.UpdatedBy = CurrentUserFullName;
        r.UpdatedAt = DateTime.UtcNow;
        await _ds.UpdateExecutorRoleAsync(r);
        return Json(new { success = true, message = r.IsActive ? "تم تفعيل الدور" : "تم تعطيل الدور", isActive = r.IsActive });
    }

    private static string? ValidateExecutorRoleDeactivateReason(bool isActive, string? deactivateReason)
    {
        if (isActive) return null;
        if (string.IsNullOrWhiteSpace(deactivateReason))
            return "سبب التعطيل مطلوب عند اختيار حالة معطل";
        return null;
    }
}

public class ExecutorRoleRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? Ownership { get; set; }
    public string? OrgUnitIds { get; set; }
    public string? ExecutorIds { get; set; }
    public string? Color { get; set; }
    public bool IsActive { get; set; } = true;
    public string? DeactivateReason { get; set; }
}

public class ExecutorRoleUpdateRequest : ExecutorRoleRequest
{
    public int Id { get; set; }
    public int SortOrder { get; set; }
}

public class ExecutorRoleIdRequest
{
    public int Id { get; set; }
}

public class ExecutorRoleToggleRequest
{
    public int Id { get; set; }
    public string? DeactivateReason { get; set; }
}
