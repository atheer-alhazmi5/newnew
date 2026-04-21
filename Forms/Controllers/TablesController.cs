using FormsSystem.Models.Entities;
using FormsSystem.Services;
using Microsoft.AspNetCore.Mvc;

namespace FormsSystem.Controllers;

public class TablesController : BaseController
{
    private readonly DataService _ds;
    private readonly UiHelperService _ui;

    public TablesController(DataService ds, UiHelperService ui)
    {
        _ds = ds;
        _ui = ui;
    }

    public IActionResult Index()
    {
        var auth = RequireAuth();
        if (auth != null) return auth;
        SetViewBagUser(_ui);
        ViewBag.PageName = "الجداول الجاهزة";
        return View();
    }

    [HttpGet]
    public async Task<IActionResult> GetReadyTables(string? search, string? rowCountMode, string? ownership, int? orgUnitId)
    {
        if (!IsAuthenticated)
            return Json(new { success = false, message = "غير مصرح" });

        var all = await _ds.ListReadyTablesAsync();

        if (CurrentUserRole != "Admin")
        {
            var userOrgUnitId = await GetCreatorOrgUnitIdAsync();
            all = all.Where(t => t.Ownership == "عام" || (t.Ownership == "خاص" && t.OrganizationalUnitId == userOrgUnitId)).ToList();
        }
        var units = await _ds.ListOrganizationalUnitsAsync();
        var activeUnits = units.Where(u => u.IsActive).OrderBy(u => u.SortOrder).ToList();
        var fields = await Task.WhenAll(all.Select(async t => (t.Id, Count: (await _ds.ListReadyTableFieldsByTableIdAsync(t.Id)).Count)));
        var fieldCounts = fields.ToDictionary(x => x.Id, x => x.Count);

        var filtered = all.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            filtered = filtered.Where(t => (t.Name?.ToLower().Contains(s) ?? false) || (t.Description?.ToLower().Contains(s) ?? false));
        }
        if (!string.IsNullOrWhiteSpace(rowCountMode))
            filtered = filtered.Where(t => t.RowCountMode == rowCountMode);
        if (!string.IsNullOrWhiteSpace(ownership))
            filtered = filtered.Where(t => t.Ownership == ownership);
        if (orgUnitId.HasValue && orgUnitId.Value > 0)
            filtered = filtered.Where(t => t.OrganizationalUnitId == orgUnitId.Value);

        var result = filtered.Select(t => new
        {
            t.Id, t.Name, t.Description, t.SortOrder,
            FieldCount = fieldCounts.GetValueOrDefault(t.Id, 0),
            t.RowCountMode, t.MaxRows, t.OrganizationalUnitId,
            OrganizationalUnitName = units.FirstOrDefault(u => u.Id == t.OrganizationalUnitId)?.Name ?? "",
            t.Ownership, t.ColumnHeaderColor, t.IsActive, t.CreatedBy,
            CreatedAt = t.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
            t.UpdatedBy, UpdatedAt = t.UpdatedAt?.ToString("yyyy-MM-dd HH:mm")
        }).OrderBy(x => x.SortOrder).ToList();

        return Json(new
        {
            success = true, data = result,
            organizationalUnits = activeUnits.Select(u => new { u.Id, u.Name }).ToList(),
            currentUser = CurrentUserFullName, isAdmin = CurrentUserRole == "Admin"
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetReadyTableDetails(int id)
    {
        if (!IsAuthenticated)
            return Json(new { success = false, message = "غير مصرح" });

        var t = await _ds.GetReadyTableByIdAsync(id);
        if (t == null)
            return Json(new { success = false, message = "الجدول غير موجود" });

        var units = await _ds.ListOrganizationalUnitsAsync();
        var fields = await _ds.ListReadyTableFieldsByTableIdAsync(id);

        return Json(new
        {
            success = true,
            data = new
            {
                t.Id, t.Name, t.Description, t.SortOrder, t.RowCountMode, t.MaxRows,
                t.OrganizationalUnitId,
                OrganizationalUnitName = units.FirstOrDefault(u => u.Id == t.OrganizationalUnitId)?.Name ?? "",
                t.Ownership, t.ColumnHeaderColor, t.IsActive, t.CreatedBy,
                CreatedAt = t.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
                t.UpdatedBy, UpdatedAt = t.UpdatedAt?.ToString("yyyy-MM-dd HH:mm"),
                Fields = fields.Select(f => new {
                    f.Id, f.FieldName, f.FieldType, f.SortOrder, f.IsRequired,
                    f.SubName, f.Placeholder, f.TooltipText, f.PropertiesJson
                })
            }
        });
    }

    private async Task<int> GetCreatorOrgUnitIdAsync()
    {
        var user = await _ds.GetUserByIdAsync(CurrentUserId);
        if (user != null && !string.IsNullOrEmpty(user.Email))
        {
            var beneficiary = await _ds.GetBeneficiaryByEmailAsync(user.Email);
            if (beneficiary != null) return beneficiary.OrganizationalUnitId;
        }
        var units = await _ds.ListOrganizationalUnitsAsync();
        return units.Count > 0 ? units.First().Id : 0;
    }

    [HttpPost]
    public async Task<IActionResult> AddReadyTable([FromBody] ReadyTableRequest req)
    {
        if (!IsAuthenticated)
            return Json(new { success = false, message = "غير مصرح" });

        if (string.IsNullOrWhiteSpace(req.Name))
            return Json(new { success = false, message = "اسم الجدول مطلوب" });

        var isAdminUser = CurrentUserRole == "Admin";
        string ownership;
        if (isAdminUser)
            ownership = "عام";
        else if (string.IsNullOrWhiteSpace(req.Ownership) || (req.Ownership != "عام" && req.Ownership != "خاص"))
            return Json(new { success = false, message = "الملكية مطلوبة (عام أو خاص)" });
        else
            ownership = req.Ownership!;

        if (req.RowCountMode == "مقيد" && (!req.MaxRows.HasValue || req.MaxRows.Value < 1))
            return Json(new { success = false, message = "يجب تحديد الحد الأقصى لعدد الصفوف عندما يكون الجدول مقيداً" });

        var orgUnitId = await GetCreatorOrgUnitIdAsync();

        var all = await _ds.ListReadyTablesAsync();
        var nextOrder = all.Count > 0 ? all.Max(t => t.SortOrder) + 1 : 1;

        var table = new ReadyTable
        {
            Name = req.Name.Trim(),
            Description = req.Description?.Trim() ?? "",
            SortOrder = nextOrder,
            RowCountMode = req.RowCountMode ?? "مفتوح",
            MaxRows = req.RowCountMode == "مقيد" ? req.MaxRows : null,
            OrganizationalUnitId = orgUnitId,
            Ownership = ownership,
            ColumnHeaderColor = req.ColumnHeaderColor ?? "",
            IsActive = req.IsActive,
            CreatedBy = CurrentUserFullName
        };

        await _ds.AddReadyTableAsync(table);

        if (req.Fields != null && req.Fields.Count > 0)
        {
            for (int i = 0; i < req.Fields.Count; i++)
            {
                var f = req.Fields[i];
                await _ds.AddReadyTableFieldAsync(new ReadyTableField
                {
                    ReadyTableId = table.Id,
                    FieldName = f.FieldName?.Trim() ?? "",
                    FieldType = f.FieldType ?? "نص قصير",
                    SortOrder = i + 1,
                    IsRequired = f.IsRequired,
                    SubName = f.SubName ?? "",
                    Placeholder = f.Placeholder ?? "",
                    TooltipText = f.TooltipText ?? "",
                    PropertiesJson = f.PropertiesJson ?? "{}"
                });
            }
        }

        await _ds.AddAuditLogAsync(BuildAuditEntry("إضافة جدول جاهز", "ReadyTable", table.Id.ToString(), table.Name));
        return Json(new { success = true, message = "تم إضافة الجدول بنجاح", id = table.Id });
    }

    [HttpPost]
    public async Task<IActionResult> UpdateReadyTable([FromBody] ReadyTableUpdateRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var t = await _ds.GetReadyTableByIdAsync(req.Id);
        if (t == null) return Json(new { success = false, message = "الجدول غير موجود" });

        var canEdit = t.CreatedBy == CurrentUserFullName || CurrentUserRole == "Admin";
        if (!canEdit) return Json(new { success = false, message = "غير مصرح بتعديل هذا الجدول" });

        if (string.IsNullOrWhiteSpace(req.Name))
            return Json(new { success = false, message = "اسم الجدول مطلوب" });

        t.Name = req.Name.Trim();
        t.Description = req.Description?.Trim() ?? "";
        if (req.SortOrder > 0) t.SortOrder = req.SortOrder;
        t.RowCountMode = req.RowCountMode ?? t.RowCountMode;
        t.MaxRows = req.RowCountMode == "مقيد" ? req.MaxRows : null;
        t.Ownership = "عام";
        t.ColumnHeaderColor = req.ColumnHeaderColor ?? t.ColumnHeaderColor;
        t.IsActive = req.IsActive;
        t.UpdatedBy = CurrentUserFullName;
        t.UpdatedAt = DateTime.UtcNow;

        if (req.Fields != null)
        {
            var existing = await _ds.ListReadyTableFieldsByTableIdAsync(t.Id);
            foreach (var ef in existing) await _ds.DeleteReadyTableFieldAsync(ef.Id);

            for (int i = 0; i < req.Fields.Count; i++)
            {
                var f = req.Fields[i];
                await _ds.AddReadyTableFieldAsync(new ReadyTableField
                {
                    ReadyTableId = t.Id,
                    FieldName = f.FieldName?.Trim() ?? "",
                    FieldType = f.FieldType ?? "نص قصير",
                    SortOrder = i + 1,
                    IsRequired = f.IsRequired,
                    SubName = f.SubName ?? "",
                    Placeholder = f.Placeholder ?? "",
                    TooltipText = f.TooltipText ?? "",
                    PropertiesJson = f.PropertiesJson ?? "{}"
                });
            }
        }

        await _ds.UpdateReadyTableAsync(t);
        await _ds.AddAuditLogAsync(BuildAuditEntry("تحديث جدول جاهز", "ReadyTable", t.Id.ToString(), t.Name));
        return Json(new { success = true, message = "تم تحديث الجدول بنجاح" });
    }

    [HttpPost]
    public async Task<IActionResult> DeleteReadyTable([FromBody] TableIdRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var t = await _ds.GetReadyTableByIdAsync(req.Id);
        if (t == null) return Json(new { success = false, message = "الجدول غير موجود" });

        var canDelete = t.CreatedBy == CurrentUserFullName || CurrentUserRole == "Admin";
        if (!canDelete) return Json(new { success = false, message = "غير مصرح بحذف هذا الجدول" });

        if (await _ds.IsReadyTableLinkedAsync(req.Id))
            return Json(new { success = false, message = LinkedEntityDeleteBlockedMessage });

        await _ds.DeleteReadyTableAsync(req.Id);
        await _ds.AddAuditLogAsync(BuildAuditEntry("حذف جدول جاهز", "ReadyTable", req.Id.ToString(), t.Name));
        return Json(new { success = true, message = "تم حذف الجدول بنجاح" });
    }
}

public class ReadyTableRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? RowCountMode { get; set; }
    public int? MaxRows { get; set; }
    public string? Ownership { get; set; }
    public string? ColumnHeaderColor { get; set; }
    public bool IsActive { get; set; } = true;
    public List<ReadyTableFieldInput>? Fields { get; set; }
}

public class ReadyTableUpdateRequest : ReadyTableRequest
{
    public int Id { get; set; }
    public int SortOrder { get; set; }
}

public class ReadyTableFieldInput
{
    public string? FieldName { get; set; }
    public string? FieldType { get; set; }
    public bool IsRequired { get; set; }
    public string? SubName { get; set; }
    public string? Placeholder { get; set; }
    public string? TooltipText { get; set; }
    public string? PropertiesJson { get; set; }
}

public class TableIdRequest
{
    public int Id { get; set; }
}
