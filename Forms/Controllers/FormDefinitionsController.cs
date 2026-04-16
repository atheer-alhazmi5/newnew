using FormsSystem.Models.Entities;
using FormsSystem.Services;
using Microsoft.AspNetCore.Mvc;

namespace FormsSystem.Controllers;

public class FormDefinitionsController : BaseController
{
    private readonly DataService _ds;
    private readonly UiHelperService _ui;

    public FormDefinitionsController(DataService ds, UiHelperService ui)
    {
        _ds = ds;
        _ui = ui;
    }

    public IActionResult Index()
    {
        var auth = RequireAuth();
        if (auth != null) return auth;
        if (CurrentUserRole != "Admin" && CurrentUserRole != "Employee")
            return RedirectToAction("Index", "Inbox");
        SetViewBagUser(_ui);
        ViewBag.PageName = "النماذج المستخدمة";
        return View();
    }

    // ── GET LIST ─────────────────────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetFormDefinitions(string? search, string? status, int? formClassId, int? typeId)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });

        var all = await _ds.ListFormDefinitionsAsync();
        var isAdmin = CurrentUserRole == "Admin";

        // Role filter
        if (!isAdmin)
        {
            var myOrgUnitId = await GetCreatorOrgUnitIdAsync();
            all = all.Where(f =>
                f.Ownership == "عام" ||
                (f.Ownership == "خاص" && f.OrganizationalUnitId == myOrgUnitId)
            ).ToList();
        }

        // Search filters
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            all = all.Where(f => f.Name.ToLower().Contains(s) || f.Description.ToLower().Contains(s)).ToList();
        }
        if (!string.IsNullOrWhiteSpace(status))
            all = all.Where(f => f.Status == status).ToList();
        if (formClassId.HasValue && formClassId.Value > 0)
            all = all.Where(f => f.FormClassId == formClassId.Value).ToList();
        if (typeId.HasValue && typeId.Value > 0)
            all = all.Where(f => f.FormTypeId == typeId.Value).ToList();

        var formClassesAll = await _ds.ListFormClassesAsync();
        var formTypesAll = await _ds.ListFormSectionsAsync();
        var formClasses = await _ds.ListActiveFormClassesAsync();
        var formTypes = await _ds.ListActiveFormSectionsAsync();
        var workspacesAll = await _ds.ListWorkspacesAsync();
        var activeWorkspaces = await _ds.ListActiveWorkspacesAsync();
        var templates = await _ds.ListFormTemplatesAsync();
        var units = await _ds.ListOrganizationalUnitsAsync();

        var data = all.Select(f => new
        {
            f.Id, f.Name, f.Description, f.Ownership, f.Status,
            f.IsActive, f.CreatedBy, f.ApprovedBy,
            CreatedAt = f.CreatedAt.ToString("yyyy-MM-dd"),
            ApprovedAt = f.ApprovedAt?.ToString("yyyy-MM-dd"),
            f.RejectionReason,
            FormClassName = formClassesAll.FirstOrDefault(c => c.Id == f.FormClassId)?.Name ?? "",
            FormTypeName = formTypesAll.FirstOrDefault(t => t.Id == f.FormTypeId)?.Name ?? "",
            WorkspaceName = workspacesAll.FirstOrDefault(w => w.Id == f.WorkspaceId)?.Name ?? "",
            TemplateName = !string.IsNullOrWhiteSpace(f.TemplateNameSnapshot)
                ? f.TemplateNameSnapshot
                : (templates.FirstOrDefault(t => t.Id == f.TemplateId)?.Name ?? ""),
            OrgUnitName = units.FirstOrDefault(u => u.Id == f.OrganizationalUnitId)?.Name ?? "",
        }).ToList();

        return Json(new
        {
            success = true, data,
            isAdmin,
            currentUserId = CurrentUserId,
            currentUser = CurrentUserFullName,
            formClasses = formClasses.Select(c => new { c.Id, c.Name }),
            formTypes = formTypes.Select(t => new { t.Id, t.Name }),
            workspaces = activeWorkspaces.Select(w => new { w.Id, w.Name }),
            templates = templates.Where(t => t.IsActive).Select(t => new { t.Id, t.Name }),
        });
    }

    // ── GET SINGLE ───────────────────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetFormDefinition(int id)
    {
        if (!IsAuthenticated) return Json(new { success = false });
        var f = await _ds.GetFormDefinitionByIdAsync(id);
        if (f == null) return Json(new { success = false, message = "غير موجود" });

        var formClassesAll = await _ds.ListFormClassesAsync();
        var activeFormClasses = await _ds.ListActiveFormClassesAsync();
        var formTypesAll = await _ds.ListFormSectionsAsync();
        var workspacesAll = await _ds.ListWorkspacesAsync();
        var activeWorkspaces = await _ds.ListActiveWorkspacesAsync();
        var templates = await _ds.ListFormTemplatesAsync();
        var units = await _ds.ListOrganizationalUnitsAsync();

        var formClassesForSelect = activeFormClasses
            .Select(fc => new { id = fc.Id, name = fc.Name })
            .ToList();
        var curFormClass = formClassesAll.FirstOrDefault(x => x.Id == f.FormClassId);
        if (curFormClass != null && !curFormClass.IsActive && formClassesForSelect.All(x => x.id != curFormClass.Id))
            formClassesForSelect.Add(new { id = curFormClass.Id, name = curFormClass.Name + " (غير مفعّل)" });

        var wsForSelect = activeWorkspaces
            .Select(w => new { id = w.Id, name = w.Name })
            .ToList();
        var currentWs = workspacesAll.FirstOrDefault(w => w.Id == f.WorkspaceId);
        if (currentWs != null && !currentWs.IsActive && wsForSelect.All(x => x.id != currentWs.Id))
            wsForSelect.Add(new { id = currentWs.Id, name = currentWs.Name + " (غير مفعّل)" });

        var tpl = templates.FirstOrDefault(t => t.Id == f.TemplateId);
        var hasSnapshot = !string.IsNullOrWhiteSpace(f.TemplateHeaderJsonSnapshot) || !string.IsNullOrWhiteSpace(f.TemplateFooterJsonSnapshot);

        return Json(new
        {
            success = true,
            data = new
            {
                f.Id, f.Name, f.Description, f.Ownership,
                f.FormClassId, f.FormTypeId, f.WorkspaceId, f.TemplateId,
                f.OrganizationalUnitId, f.Status, f.IsActive,
                f.FieldsJson, f.RejectionReason,
                f.CreatedBy, f.ApprovedBy,
                CreatedAt = f.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
                ApprovedAt = f.ApprovedAt?.ToString("yyyy-MM-dd HH:mm"),
                FormClassName = formClassesAll.FirstOrDefault(c => c.Id == f.FormClassId)?.Name ?? "",
                FormTypeName = formTypesAll.FirstOrDefault(t => t.Id == f.FormTypeId)?.Name ?? "",
                WorkspaceName = workspacesAll.FirstOrDefault(w => w.Id == f.WorkspaceId)?.Name ?? "",
                TemplateName = !string.IsNullOrWhiteSpace(f.TemplateNameSnapshot) ? f.TemplateNameSnapshot : (tpl?.Name ?? ""),
                OrgUnitName = units.FirstOrDefault(u => u.Id == f.OrganizationalUnitId)?.Name ?? "",
                
                TemplateData = hasSnapshot ? new
                {
                    Id = f.TemplateId,
                    Name = !string.IsNullOrWhiteSpace(f.TemplateNameSnapshot) ? f.TemplateNameSnapshot : (tpl?.Name ?? ""),
                    Color = !string.IsNullOrWhiteSpace(f.TemplateColorSnapshot) ? f.TemplateColorSnapshot : (tpl?.Color ?? "#14573A"),
                    HeaderJson = string.IsNullOrWhiteSpace(f.TemplateHeaderJsonSnapshot) ? "[]" : f.TemplateHeaderJsonSnapshot,
                    FooterJson = string.IsNullOrWhiteSpace(f.TemplateFooterJsonSnapshot) ? "[]" : f.TemplateFooterJsonSnapshot,
                    HeaderSections = 0,
                    FooterSections = 0,
                    MarginTop = f.TemplateMarginTopSnapshot,
                    MarginBottom = f.TemplateMarginBottomSnapshot,
                    MarginRight = f.TemplateMarginRightSnapshot,
                    MarginLeft = f.TemplateMarginLeftSnapshot,
                    PageDirection = string.IsNullOrWhiteSpace(f.TemplatePageDirectionSnapshot) ? "RTL" : f.TemplatePageDirectionSnapshot,
                    ShowHeaderLine = f.TemplateShowHeaderLineSnapshot,
                    ShowFooterLine = f.TemplateShowFooterLineSnapshot
                } : (tpl == null ? null : new
                {
                    tpl.Id, tpl.Name, tpl.Color,
                    tpl.HeaderJson, tpl.FooterJson,
                    tpl.HeaderSections, tpl.FooterSections,
                    tpl.MarginTop, tpl.MarginBottom, tpl.MarginRight, tpl.MarginLeft,
                    tpl.PageDirection, tpl.ShowHeaderLine, tpl.ShowFooterLine
                })
            },
            workspaces = wsForSelect,
            formClasses = formClassesForSelect
        });
    }

    // ── ADD ──────────────────────────────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> AddFormDefinition([FromBody] FormDefRequest req)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        if (CurrentUserRole != "Admin" && CurrentUserRole != "Employee")
            return Json(new { success = false, message = "غير مصرح" });
        if (string.IsNullOrWhiteSpace(req.Name))
            return Json(new { success = false, message = "اسم النموذج مطلوب" });
        if (req.FormClassId <= 0) return Json(new { success = false, message = "أصناف النماذج مطلوبة" });
        if (req.FormTypeId <= 0) return Json(new { success = false, message = "نوع النموذج مطلوب" });
        if (req.WorkspaceId <= 0) return Json(new { success = false, message = "مساحة العمل مطلوبة" });
        if (req.TemplateId <= 0) return Json(new { success = false, message = "القالب المستخدم مطلوب" });

        var selectedTemplate = await _ds.GetFormTemplateByIdAsync(req.TemplateId);
        if (selectedTemplate == null || !selectedTemplate.IsActive)
            return Json(new { success = false, message = "القالب غير متاح أو غير مفعل" });

        var selFc = await _ds.GetFormClassByIdAsync(req.FormClassId);
        if (selFc == null || !selFc.IsActive)
            return Json(new { success = false, message = "صنف النموذج غير صالح أو غير مفعّل" });
        var selType = await _ds.GetFormSectionByIdAsync(req.FormTypeId);
        if (selType == null || !selType.IsActive)
            return Json(new { success = false, message = "نوع النموذج غير صالح أو غير مفعّل" });
        var selWs = await _ds.GetWorkspaceByIdAsync(req.WorkspaceId);
        if (selWs == null || !selWs.IsActive)
            return Json(new { success = false, message = "مساحة العمل غير صالحة أو غير مفعّل" });

        var isAdmin = CurrentUserRole == "Admin";

        var orgUnitId = await GetCreatorOrgUnitIdAsync();
        var f = new FormDefinition
        {
            Name = req.Name.Trim(),
            Description = req.Description?.Trim() ?? "",
            Ownership = isAdmin ? "عام" : (req.Ownership ?? "عام"),
            CategoryId = 0,
            FormClassId = req.FormClassId,
            FormTypeId = req.FormTypeId,
            WorkspaceId = req.WorkspaceId,
            TemplateId = req.TemplateId,
            OrganizationalUnitId = orgUnitId,
            Status = req.SendForApproval ? (isAdmin ? "approved" : "pending") : "draft",
            IsActive = req.SendForApproval && isAdmin,
            FieldsJson = req.FieldsJson ?? "[]",
            CreatedBy = CurrentUserFullName,
        };
        if (isAdmin && req.SendForApproval)
        {
            f.ApprovedBy = CurrentUserFullName;
            f.ApprovedAt = DateTime.Now;
        }
        ApplyTemplateSnapshot(f, selectedTemplate);
        var created = await _ds.AddFormDefinitionAsync(f);
        await _ds.AddAuditLogAsync(BuildAuditEntry("إضافة نموذج", "FormDefinition", created.Id.ToString(), req.Name));
        return Json(new { success = true, id = created.Id });
    }

    // ── UPDATE ───────────────────────────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> UpdateFormDefinition([FromBody] FormDefUpdateRequest req)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        var f = await _ds.GetFormDefinitionByIdAsync(req.Id);
        if (f == null) return Json(new { success = false, message = "غير موجود" });
        if (f.Status == "approved" && CurrentUserRole != "Admin")
            return Json(new { success = false, message = "لا يمكن تعديل نموذج معتمد" });
        if (req.FormClassId <= 0) return Json(new { success = false, message = "أصناف النماذج مطلوبة" });
        if (req.FormTypeId <= 0) return Json(new { success = false, message = "نوع النموذج مطلوب" });
        if (req.WorkspaceId <= 0) return Json(new { success = false, message = "مساحة العمل مطلوبة" });
        if (req.TemplateId <= 0) return Json(new { success = false, message = "القالب المستخدم مطلوب" });

        var selectedTemplate = await _ds.GetFormTemplateByIdAsync(req.TemplateId);
        if (selectedTemplate == null || !selectedTemplate.IsActive)
            return Json(new { success = false, message = "القالب غير متاح أو غير مفعل" });

        var selFc = await _ds.GetFormClassByIdAsync(req.FormClassId);
        if (selFc == null || !selFc.IsActive)
            return Json(new { success = false, message = "صنف النموذج غير صالح أو غير مفعّل" });
        var selType = await _ds.GetFormSectionByIdAsync(req.FormTypeId);
        if (selType == null || !selType.IsActive)
            return Json(new { success = false, message = "نوع النموذج غير صالح أو غير مفعّل" });
        var selWs = await _ds.GetWorkspaceByIdAsync(req.WorkspaceId);
        if (selWs == null || !selWs.IsActive)
            return Json(new { success = false, message = "مساحة العمل غير صالحة أو غير مفعّل" });

        var isAdmin = CurrentUserRole == "Admin";

        f.Name = req.Name?.Trim() ?? f.Name;
        f.Description = req.Description?.Trim() ?? f.Description;
        f.Ownership = isAdmin ? "عام" : (req.Ownership ?? f.Ownership);
        f.CategoryId = 0;
        f.FormClassId = req.FormClassId;
        f.FormTypeId = req.FormTypeId;
        f.WorkspaceId = req.WorkspaceId;
        f.TemplateId = req.TemplateId;
        f.FieldsJson = req.FieldsJson ?? f.FieldsJson;
        f.UpdatedBy = CurrentUserFullName;
        f.UpdatedAt = DateTime.Now;
        ApplyTemplateSnapshot(f, selectedTemplate);
        if (req.SendForApproval)
        {
            if (isAdmin)
            {
                f.Status = "approved";
                f.IsActive = true;
                f.RejectionReason = "";
                f.ApprovedBy = CurrentUserFullName;
                f.ApprovedAt = DateTime.Now;
            }
            else if (f.Status == "draft")
            {
                f.Status = "pending";
                f.IsActive = false;
            }
        }

        await _ds.UpdateFormDefinitionAsync(f);
        await _ds.AddAuditLogAsync(BuildAuditEntry("تعديل نموذج", "FormDefinition", f.Id.ToString(), f.Name));
        return Json(new { success = true });
    }

    // ── DELETE ───────────────────────────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> DeleteFormDefinition([FromBody] FormDefIdRequest req)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        var f = await _ds.GetFormDefinitionByIdAsync(req.Id);
        if (f == null) return Json(new { success = false, message = "غير موجود" });
        if (f.Status == "approved" && CurrentUserRole != "Admin")
            return Json(new { success = false, message = "لا يمكن حذف نموذج معتمد" });

        await _ds.DeleteFormDefinitionAsync(req.Id);
        await _ds.AddAuditLogAsync(BuildAuditEntry("حذف نموذج", "FormDefinition", req.Id.ToString(), f.Name));
        return Json(new { success = true });
    }

    // ── SUBMIT FOR APPROVAL ──────────────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> SubmitForApproval([FromBody] FormDefIdRequest req)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        var f = await _ds.GetFormDefinitionByIdAsync(req.Id);
        if (f == null) return Json(new { success = false, message = "غير موجود" });
        if (f.Status != "draft" && f.Status != "rejected")
            return Json(new { success = false, message = "لا يمكن إرساله للاعتماد بالحالة الحالية" });

        f.Status = "pending";
        f.RejectionReason = "";
        f.UpdatedBy = CurrentUserFullName;
        f.UpdatedAt = DateTime.Now;
        await _ds.UpdateFormDefinitionAsync(f);
        await _ds.AddAuditLogAsync(BuildAuditEntry("إرسال للاعتماد", "FormDefinition", f.Id.ToString(), f.Name));
        return Json(new { success = true });
    }

    // ── APPROVE ──────────────────────────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> ApproveFormDefinition([FromBody] FormDefIdRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });
        var f = await _ds.GetFormDefinitionByIdAsync(req.Id);
        if (f == null) return Json(new { success = false, message = "غير موجود" });

        f.Status = "approved";
        f.RejectionReason = "";
        f.ApprovedBy = CurrentUserFullName;
        f.ApprovedAt = DateTime.Now;
        f.UpdatedBy = CurrentUserFullName;
        f.UpdatedAt = DateTime.Now;
        await _ds.UpdateFormDefinitionAsync(f);
        await _ds.AddAuditLogAsync(BuildAuditEntry("اعتماد نموذج", "FormDefinition", f.Id.ToString(), f.Name));
        return Json(new { success = true });
    }

    // ── REJECT ───────────────────────────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> RejectFormDefinition([FromBody] FormDefRejectRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });
        var f = await _ds.GetFormDefinitionByIdAsync(req.Id);
        if (f == null) return Json(new { success = false, message = "غير موجود" });

        f.Status = "rejected";
        f.RejectionReason = req.Reason ?? "";
        f.UpdatedBy = CurrentUserFullName;
        f.UpdatedAt = DateTime.Now;
        await _ds.UpdateFormDefinitionAsync(f);
        await _ds.AddAuditLogAsync(BuildAuditEntry("رفض نموذج", "FormDefinition", f.Id.ToString(), f.Name));
        return Json(new { success = true });
    }

    // ── TOGGLE ACTIVE (admin only) ───────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> ToggleFormDefinition([FromBody] FormDefIdRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });
        var f = await _ds.GetFormDefinitionByIdAsync(req.Id);
        if (f == null) return Json(new { success = false, message = "غير موجود" });
        if (f.Status != "approved")
            return Json(new { success = false, message = "يمكن التفعيل فقط للنماذج المعتمدة" });

        f.IsActive = !f.IsActive;
        f.UpdatedBy = CurrentUserFullName;
        f.UpdatedAt = DateTime.Now;
        await _ds.UpdateFormDefinitionAsync(f);
        return Json(new { success = true, isActive = f.IsActive });
    }

    // ── HELPER ───────────────────────────────────────────────────────────────
    private async Task<int> GetCreatorOrgUnitIdAsync()
    {
        var units = await _ds.ListOrganizationalUnitsAsync();
        var unit = units.FirstOrDefault(u => u.Id == CurrentDeptId);
        return unit?.Id ?? CurrentDeptId;
    }

    private static void ApplyTemplateSnapshot(FormDefinition f, FormTemplate t)
    {
        f.TemplateNameSnapshot = t.Name ?? "";
        f.TemplateColorSnapshot = t.Color ?? "#14573A";
        f.TemplateHeaderJsonSnapshot = string.IsNullOrWhiteSpace(t.HeaderJson) ? "[]" : t.HeaderJson;
        f.TemplateFooterJsonSnapshot = string.IsNullOrWhiteSpace(t.FooterJson) ? "[]" : t.FooterJson;
        f.TemplateMarginTopSnapshot = t.MarginTop;
        f.TemplateMarginBottomSnapshot = t.MarginBottom;
        f.TemplateMarginRightSnapshot = t.MarginRight;
        f.TemplateMarginLeftSnapshot = t.MarginLeft;
        f.TemplatePageDirectionSnapshot = string.IsNullOrWhiteSpace(t.PageDirection) ? "RTL" : t.PageDirection;
        f.TemplateShowHeaderLineSnapshot = t.ShowHeaderLine;
        f.TemplateShowFooterLineSnapshot = t.ShowFooterLine;
    }

    //  الجداول الجاهزة / القوائم المنسدلة───
    [HttpGet]
    public async Task<IActionResult> GetFieldBindingLookups()
    {
        if (!IsAuthenticated || (CurrentUserRole != "Admin" && CurrentUserRole != "Employee"))
            return Json(new { success = false, message = "غير مصرح" });

        var isAdmin = CurrentUserRole == "Admin";
        var myOrgId = await GetCreatorOrgUnitIdAsync();

        var allTables = await _ds.ListReadyTablesAsync();
        if (!isAdmin)
            allTables = allTables.Where(t => t.Ownership == "عام" || (t.Ownership == "خاص" && t.OrganizationalUnitId == myOrgId)).ToList();
        var readyTables = allTables.Where(t => t.IsActive).OrderBy(t => t.SortOrder)
            .Select(t => new { t.Id, t.Name }).ToList();

        var allLists = await _ds.ListDropdownListsAsync();
        if (!isAdmin)
            allLists = allLists.Where(l => l.Ownership == "عام" || (l.Ownership == "خاص" && l.OrganizationalUnitId == myOrgId)).ToList();
        var dropdownLists = allLists.Where(l => l.IsActive && l.ListType == "قائمة مستقلة").OrderBy(l => l.SortOrder)
            .Select(l => new { l.Id, l.Name }).ToList();

        return Json(new { success = true, readyTables, dropdownLists });
    }

    [HttpGet]
    public async Task<IActionResult> GetDropdownListItemsForField(int id)
    {
        if (!IsAuthenticated || (CurrentUserRole != "Admin" && CurrentUserRole != "Employee"))
            return Json(new { success = false, message = "غير مصرح" });

        var list = await _ds.GetDropdownListByIdAsync(id);
        var isAdmin = CurrentUserRole == "Admin";
        var myOrgId = await GetCreatorOrgUnitIdAsync();
        if (list == null || !list.IsActive || !DropdownListAllowedForUser(list, isAdmin, myOrgId))
            return Json(new { success = false, message = "القائمة غير متاحة" });

        var items = await _ds.ListDropdownItemsByListIdAsync(id);
        var texts = items.Where(i => i.IsActive).OrderBy(i => i.SortOrder).Select(i => i.ItemText ?? "").Where(s => !string.IsNullOrWhiteSpace(s)).ToList();
        return Json(new { success = true, items = texts });
    }

    [HttpGet]
    public async Task<IActionResult> GetReadyTableForField(int id)
    {
        if (!IsAuthenticated || (CurrentUserRole != "Admin" && CurrentUserRole != "Employee"))
            return Json(new { success = false, message = "غير مصرح" });

        var t = await _ds.GetReadyTableByIdAsync(id);
        var isAdmin = CurrentUserRole == "Admin";
        var myOrgId = await GetCreatorOrgUnitIdAsync();
        if (t == null || !t.IsActive || !ReadyTableAllowedForUser(t, isAdmin, myOrgId))
            return Json(new { success = false, message = "الجدول غير متاح" });

        var fields = await _ds.ListReadyTableFieldsByTableIdAsync(id);
        var columns = fields.OrderBy(f => f.SortOrder).Select(f => f.FieldName).ToList();
        return Json(new
        {
            success = true,
            t.Name,
            t.RowCountMode,
            t.MaxRows,
            columns
        });
    }

    private static bool ReadyTableAllowedForUser(ReadyTable t, bool isAdmin, int myOrgId)
    {
        if (isAdmin) return true;
        return t.Ownership == "عام" || (t.Ownership == "خاص" && t.OrganizationalUnitId == myOrgId);
    }

    private static bool DropdownListAllowedForUser(DropdownList l, bool isAdmin, int myOrgId)
    {
        if (isAdmin) return true;
        return l.Ownership == "عام" || (l.Ownership == "خاص" && l.OrganizationalUnitId == myOrgId);
    }

    // ── TEMPLATE PREVIEW DATA (accessible by Admin + Employee) ───────────────
    [HttpGet]
    public async Task<IActionResult> GetTemplateForPreview(int id)
    {
        if (!IsAuthenticated) return Json(new { success = false });
        var t = await _ds.GetFormTemplateByIdAsync(id);
        if (t == null) return Json(new { success = false, message = "القالب غير موجود" });
        return Json(new
        {
            success = true,
            data = new
            {
                t.Id, t.Name, t.Color,
                t.HeaderJson, t.FooterJson,
                t.HeaderSections, t.FooterSections,
                t.MarginTop, t.MarginBottom, t.MarginRight, t.MarginLeft,
                t.PageDirection, t.ShowHeaderLine, t.ShowFooterLine
            }
        });
    }

    // ── DTOs ─────────────────────────────────────────────────────────────────
    public class FormDefRequest
    {
        public string Name { get; set; } = "";
        public string? Description { get; set; }
        public string? Ownership { get; set; }
        public int FormClassId { get; set; }
        public int FormTypeId { get; set; }
        public int WorkspaceId { get; set; }
        public int TemplateId { get; set; }
        public string? FieldsJson { get; set; }
        public bool SendForApproval { get; set; }
    }

    public class FormDefUpdateRequest : FormDefRequest
    {
        public int Id { get; set; }
    }

    public class FormDefIdRequest { public int Id { get; set; } }

    public class FormDefRejectRequest
    {
        public int Id { get; set; }
        public string? Reason { get; set; }
    }
}
