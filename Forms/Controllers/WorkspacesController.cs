using FormsSystem.Models.Entities;
using FormsSystem.Services;
using Microsoft.AspNetCore.Mvc;

namespace FormsSystem.Controllers;

public class WorkspacesController : BaseController
{
    private readonly DataService _ds;
    private readonly UiHelperService _ui;

    public WorkspacesController(DataService ds, UiHelperService ui)
    {
        _ds = ds;
        _ui = ui;
    }

    private IActionResult? RequireAdmin()
    {
        var auth = RequireAuth();
        if (auth != null) return auth;
        if (CurrentUserRole != "Admin")
            return RedirectToAction("Index", "Forms");
        return null;
    }

    public IActionResult Index()
    {
        var deny = RequireAdmin();
        if (deny != null) return deny;
        SetViewBagUser(_ui);
        ViewBag.PageName = "مساحات العمل";
        return View();
    }

    [HttpGet]
    public async Task<IActionResult> GetWorkspaces()
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var list = await _ds.ListWorkspacesAsync();
        var units = await _ds.ListOrganizationalUnitsAsync();
        var ouMap = units.ToDictionary(u => u.Id, u => u.Name);
        return Json(new
        {
            success = true,
            data = list.Select(w => new
            {
                w.Id,
                w.Name,
                w.Description,
                w.Color,
                w.OrganizationalUnitId,
                OrganizationalUnitName = ouMap.GetValueOrDefault(w.OrganizationalUnitId, ""),
                w.SortOrder,
                w.IsActive,
                w.CreatedBy,
                w.UpdatedBy,
                CreatedAt = w.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
                UpdatedAt = w.UpdatedAt.HasValue ? w.UpdatedAt.Value.ToString("yyyy-MM-dd HH:mm") : ""
            }),
            organizationalUnits = units.OrderBy(u => u.SortOrder).Select(u => new { u.Id, u.Name, u.ParentId, u.SortOrder, u.Level }).ToList()
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetWorkspace(int id)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var w = await _ds.GetWorkspaceByIdAsync(id);
        if (w == null)
            return Json(new { success = false, message = "مساحة العمل غير موجودة" });

        var units = await _ds.ListOrganizationalUnitsAsync();
        var ouName = units.FirstOrDefault(u => u.Id == w.OrganizationalUnitId)?.Name ?? "";

        return Json(new
        {
            success = true,
            data = new
            {
                w.Id,
                w.Name,
                w.Description,
                w.Color,
                w.OrganizationalUnitId,
                OrganizationalUnitName = ouName,
                w.SortOrder,
                w.IsActive,
                w.CreatedBy,
                w.UpdatedBy,
                CreatedAt = w.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
                UpdatedAt = w.UpdatedAt.HasValue ? w.UpdatedAt.Value.ToString("yyyy-MM-dd HH:mm") : ""
            }
        });
    }

    [HttpPost]
    public async Task<IActionResult> AddWorkspace([FromBody] WorkspaceRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        if (string.IsNullOrWhiteSpace(req.Name))
            return Json(new { success = false, message = "اسم مساحة العمل مطلوب" });

        if (await _ds.IsWorkspaceNameDuplicateAsync(req.Name.Trim()))
            return Json(new { success = false, message = "اسم مساحة العمل موجود مسبقاً" });

        var all = await _ds.ListWorkspacesAsync();
        var nextOrder = all.Count > 0 ? all.Max(w => w.SortOrder) + 1 : 1;

        var row = new Workspace
        {
            Name = req.Name.Trim(),
            Description = req.Description?.Trim() ?? "",
            Color = string.IsNullOrWhiteSpace(req.Color) ? "#25935F" : req.Color.Trim(),
            OrganizationalUnitId = req.OrganizationalUnitId ?? 0,
            SortOrder = nextOrder,
            IsActive = req.IsActive,
            CreatedBy = CurrentUserFullName
        };

        await _ds.AddWorkspaceAsync(row);
        await _ds.AddAuditLogAsync(BuildAuditEntry("إضافة مساحة عمل", "Workspace", row.Id.ToString(), row.Name));

        return Json(new { success = true, message = "تم إنشاء مساحة العمل بنجاح" });
    }

    [HttpPost]
    public async Task<IActionResult> UpdateWorkspace([FromBody] WorkspaceUpdateRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        if (string.IsNullOrWhiteSpace(req.Name))
            return Json(new { success = false, message = "اسم مساحة العمل مطلوب" });

        var row = await _ds.GetWorkspaceByIdAsync(req.Id);
        if (row == null)
            return Json(new { success = false, message = "مساحة العمل غير موجودة" });

        if (await _ds.IsWorkspaceNameDuplicateAsync(req.Name.Trim(), req.Id))
            return Json(new { success = false, message = "اسم مساحة العمل موجود مسبقاً" });

        var oldOrder = row.SortOrder;
        row.Name = req.Name.Trim();
        row.Description = req.Description?.Trim() ?? "";
        row.Color = string.IsNullOrWhiteSpace(req.Color) ? row.Color : req.Color.Trim();
        if (req.OrganizationalUnitId.HasValue && req.OrganizationalUnitId.Value > 0)
            row.OrganizationalUnitId = req.OrganizationalUnitId.Value;
        row.IsActive = req.IsActive;
        row.UpdatedBy = CurrentUserFullName;
        row.UpdatedAt = DateTime.Now;

        await _ds.UpdateWorkspaceAsync(row);

        if (req.SortOrder > 0 && req.SortOrder != oldOrder)
            await _ds.ReorderWorkspacesAsync(row.Id, req.SortOrder);

        await _ds.AddAuditLogAsync(BuildAuditEntry("تحديث مساحة عمل", "Workspace", row.Id.ToString(), row.Name));

        return Json(new { success = true, message = "تم تحديث مساحة العمل بنجاح" });
    }

    [HttpPost]
    public async Task<IActionResult> DeleteWorkspace([FromBody] WorkspaceDeleteRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var row = await _ds.GetWorkspaceByIdAsync(req.Id);
        if (row == null)
            return Json(new { success = false, message = "مساحة العمل غير موجودة" });

        await _ds.DeleteWorkspaceAsync(req.Id);

        var all = await _ds.ListWorkspacesAsync();
        for (int i = 0; i < all.Count; i++)
            all[i].SortOrder = i + 1;
        foreach (var w in all)
            await _ds.UpdateWorkspaceAsync(w);

        await _ds.AddAuditLogAsync(BuildAuditEntry("حذف مساحة عمل", "Workspace", req.Id.ToString(), row.Name));

        return Json(new { success = true, message = "تم حذف مساحة العمل بنجاح" });
    }
}

public class WorkspaceRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? Color { get; set; }
    public int? OrganizationalUnitId { get; set; }
    public bool IsActive { get; set; } = true;
}

public class WorkspaceUpdateRequest : WorkspaceRequest
{
    public int Id { get; set; }
    public int SortOrder { get; set; }
}

public class WorkspaceDeleteRequest
{
    public int Id { get; set; }
}
