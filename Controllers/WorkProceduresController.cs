using System.Text.Json;
using System.Text.RegularExpressions;
using FormsSystem.Models.Entities;
using FormsSystem.Services;
using Microsoft.AspNetCore.Mvc;

namespace FormsSystem.Controllers;

public class WorkProceduresController : BaseController
{
    private readonly DataService _ds;
    private readonly UiHelperService _ui;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = false
    };

    public WorkProceduresController(DataService ds, UiHelperService ui)
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
        ViewBag.PageName = "إجراءات العمل";
        return View();
    }

    /// <summary>عرض التفويضات الخاصة بالمستخدم بعد تسجيل الدخول.</summary>
    public IActionResult MyDelegations()
    {
        var auth = RequireAuth();
        if (auth != null) return auth;
        SetViewBagUser(_ui);
        ViewBag.Title = "التفويضات";
        ViewBag.PageName = "التفويضات";
        return View();
    }

    [HttpGet]
    public IActionResult Workflow(int id)
    {
        var auth = RequireAuth();
        if (auth != null) return auth;
        if (CurrentUserRole != "Admin" && CurrentUserRole != "Employee")
            return RedirectToAction("Index", "Forms");
        if (id <= 0)
            return RedirectToAction(nameof(Index));
        SetViewBagUser(_ui);
        ViewBag.Title = "إدارة سير عمل الإجراء";
        ViewBag.PageName = "إدارة سير عمل الإجراء";
        ViewBag.WorkProcedureId = id;
        return View();
    }

    [HttpGet]
    public async Task<IActionResult> GetWorkProcedures(
        string? search,
        string? status,
        string? validity,
        int? formDefinitionId,
        int? targetOrgUnitId,
        int? executorBeneficiaryId,
        int? executorRoleId,
        string? isActive)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });

        await ApplyAutoCloseExpiredAsync();

        var all = await _ds.ListWorkProceduresAsync();
        var isAdmin = CurrentUserRole == "Admin";
        var unitsAll = await _ds.ListOrganizationalUnitsAsync();
        var myOrgUnitId = await GetCreatorOrgUnitIdAsync();
        var allowedOrgIds = DescendantOrgUnitIdsIncludingSelf(myOrgUnitId, unitsAll);

        if (isAdmin)
            all = WorkProcedureVisibility.FilterForAdmin(all, CurrentUserFullName).ToList();
        else
            all = all.Where(p => allowedOrgIds.Contains(p.OrganizationalUnitId)).ToList();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            all = all.Where(p => (p.Name ?? "").ToLower().Contains(s)).ToList();
        }
        if (formDefinitionId.HasValue && formDefinitionId.Value > 0)
            all = all.Where(p => ProcedureUsesFormDefinition(p, formDefinitionId.Value)).ToList();
        if (!string.IsNullOrWhiteSpace(validity))
            all = all.Where(p => p.ValidityType == validity).ToList();
        if (targetOrgUnitId.HasValue && targetOrgUnitId.Value > 0)
            all = all.Where(p => ProcedureTargetsOrganizationalUnit(p, targetOrgUnitId.Value)).ToList();
        if (executorRoleId.HasValue && executorRoleId.Value > 0)
        {
            var execRolesForRoleFilter = await ListExecutorRolesForUserAsync(isAdmin, allowedOrgIds);
            var role = execRolesForRoleFilter.FirstOrDefault(r => r.Id == executorRoleId.Value);
            if (role != null)
            {
                var roleBenIds = ParseCsvIntIds(role.ExecutorIds).ToHashSet();
                all = all.Where(p => ProcedureHasAnyExecutorBeneficiaryInSet(p, roleBenIds)).ToList();
            }
        }
        else if (executorBeneficiaryId.HasValue && executorBeneficiaryId.Value > 0)
            all = all.Where(p => ProcedureHasExecutorBeneficiary(p, executorBeneficiaryId.Value)).ToList();
        if (!string.IsNullOrWhiteSpace(status))
            all = all.Where(p => p.Status == status).ToList();
        if (!string.IsNullOrWhiteSpace(isActive))
        {
            var want = isActive == "1";
            all = all.Where(p => DataService.GetEffectiveIsActive(p) == want).ToList();
        }

        var procTypesAll = await _ds.ListProcedureActionTypesAsync();
        var templatesAll = await _ds.ListFormTemplatesAsync();

        var data = all.Select(p => new
        {
            p.Id,
            p.Code,
            p.Name,
            ProcedureActionTypeName = procTypesAll.FirstOrDefault(t => t.Id == p.ProcedureActionTypeId)?.Name ?? "",
            p.UsageFrequency,
            p.ConfidentialityLevel,
            ProcedureClassification = p.ProcedureClassification,
            OrgUnitName = unitsAll.FirstOrDefault(u => u.Id == p.OrganizationalUnitId)?.Name ?? "",
            ValidityType = p.ValidityType,
            FormTemplateName = templatesAll.FirstOrDefault(t => t.Id == p.FormTemplateId)?.Name ?? "",
            VersionLabel = string.IsNullOrWhiteSpace(p.VersionLabel) ? "V1.0" : p.VersionLabel.Trim(),
            p.Status,
            IsActive = DataService.GetEffectiveIsActive(p),
            p.CreatedBy,
            p.ApprovedBy,
            CreatedAt = p.CreatedAt.ToString("yyyy-MM-dd"),
            ApprovedAt = p.ApprovedAt?.ToString("yyyy-MM-dd"),
            p.RejectionReason
        }).ToList();

        var formDefsForFilter = await ListFormDefinitionsForUserAsync(isAdmin, myOrgUnitId, activeApprovedOnly: true);
        var orgUnitsForFilter = DataService.FilterEffectivelyActiveOrganizationalUnits(unitsAll);
        var execRoles = await ListExecutorRolesForProcedureExecutorsPicklistAsync(isAdmin, allowedOrgIds);
        var allowedBenIds = ParseBeneficiaryIdsFromExecutorRoles(execRoles);
        var beneficiaries = await _ds.ListBeneficiariesAsync();
        var executorBenForFilter = beneficiaries
            .Where(b => b.IsActive && allowedBenIds.Contains(b.Id))
            .OrderBy(b => b.FullName)
            .ToList();

        return Json(new
        {
            success = true,
            data,
            isAdmin,
            currentUserId = CurrentUserId,
            formDefinitions = formDefsForFilter.Select(f => new { f.Id, f.Name, f.OrganizationalUnitId }).ToList(),
            organizationalUnits = orgUnitsForFilter.Select(u => new { id = u.Id, name = u.Name }).ToList(),
            executorBeneficiaries = executorBenForFilter.Select(b => new { id = b.Id, fullName = b.FullName }).ToList()
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetLookups()
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        var isAdmin = CurrentUserRole == "Admin";
        var unitsAll = await _ds.ListOrganizationalUnitsAsync();
        var myOrgUnitId = await GetCreatorOrgUnitIdAsync();
        var allowedOrgIds = DescendantOrgUnitIdsIncludingSelf(myOrgUnitId, unitsAll);

        var formDefs = (await ListFormDefinitionsForUserAsync(isAdmin, myOrgUnitId, activeApprovedOnly: true))
            .Select(f => new { f.Id, f.Name, f.Ownership, f.OrganizationalUnitId }).ToList();
        var execRoles = await ListExecutorRolesForProcedureExecutorsPicklistAsync(isAdmin, allowedOrgIds);
        var allowedBenIds = ParseBeneficiaryIdsFromExecutorRoles(execRoles);
        var beneficiaries = await _ds.ListBeneficiariesAsync();
        var executorBeneficiaries = beneficiaries
            .Where(b => b.IsActive && allowedBenIds.Contains(b.Id))
            .OrderBy(b => b.FullName)
            .Select(b => new { id = b.Id, fullName = b.FullName })
            .ToList();
        var executorRoles = execRoles
            .Where(r => r.IsActive)
            .OrderBy(r => r.SortOrder)
            .Select(r => new
            {
                id = r.Id,
                name = r.Name,
                beneficiaryIds = ParseCsvIntIds(r.ExecutorIds)
            })
            .Where(x => x.beneficiaryIds.Count > 0)
            .ToList();
        var orgUnits = DataService.FilterEffectivelyActiveOrganizationalUnits(unitsAll)
            .Select(u => new { u.Id, u.Name, u.ParentId, Level = u.ParentId.HasValue ? "فرعي" : "رئيسي" }).ToList();

        var myUnit = unitsAll.FirstOrDefault(u => u.Id == myOrgUnitId);
        var myOrgUnitName = myUnit?.Name ?? "";

        var procedureActionTypes = (await _ds.ListProcedureActionTypesAsync())
            .Where(t => t.IsActive)
            .OrderBy(t => t.SortOrder)
            .Select(t => new { id = t.Id, name = t.Name })
            .ToList();
        var formTemplates = (await _ds.ListFormTemplatesAsync())
            .Where(t => t.IsActive)
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new { id = t.Id, name = t.Name })
            .ToList();

        return Json(new
        {
            success = true,
            formDefinitions = formDefs,
            executorBeneficiaries,
            executorRoles,
            organizationalUnits = orgUnits,
            isAdmin,
            myOrgUnitId,
            myOrgUnitName,
            procedureActionTypes,
            formTemplates
        });
    }

    /// <summary>يُستخدم عند «إصدار جديد» لعرض رقم الإصدار التالي قبل الحفظ.</summary>
    [HttpGet]
    public async Task<IActionResult> PeekNextVersionLabel(int sourceId)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        if (sourceId <= 0) return Json(new { success = false, message = "معرّف غير صالح" });
        var src = await _ds.GetWorkProcedureByIdAsync(sourceId);
        if (src == null) return Json(new { success = false, message = "غير موجود" });

        var isAdmin = CurrentUserRole == "Admin";
        var unitsAll = await _ds.ListOrganizationalUnitsAsync();
        var myOrgUnitId = await GetCreatorOrgUnitIdAsync();
        var allowedOrgIds = DescendantOrgUnitIdsIncludingSelf(myOrgUnitId, unitsAll);
        if (!CanUserAccessWorkProcedure(src, isAdmin, CurrentUserFullName, allowedOrgIds))
            return Json(new { success = false, message = "غير مصرح" });

        var rootId = src.VersionRootProcedureId > 0 ? src.VersionRootProcedureId : src.Id;
        var next = await ComputeNextWorkProcedureVersionLabelAsync(rootId);
        return Json(new { success = true, nextVersionLabel = next });
    }

    [HttpGet]
    public async Task<IActionResult> GetWorkProcedure(int id)
    {
        if (!IsAuthenticated) return Json(new { success = false });
        await ApplyAutoCloseExpiredAsync();
        var p = await _ds.GetWorkProcedureByIdAsync(id);
        if (p == null) return Json(new { success = false, message = "غير موجود" });

        var isAdmin = CurrentUserRole == "Admin";
        var unitsAll = await _ds.ListOrganizationalUnitsAsync();
        var myOrgUnitId = await GetCreatorOrgUnitIdAsync();
        var allowedOrgIds = DescendantOrgUnitIdsIncludingSelf(myOrgUnitId, unitsAll);
        if (!CanUserAccessWorkProcedure(p, isAdmin, CurrentUserFullName, allowedOrgIds))
            return Json(new { success = false, message = "غير مصرح" });

        var usedFormPickerExtras = await BuildUsedFormPickerExtrasAsync(p, isAdmin, myOrgUnitId);

        var pat = p.ProcedureActionTypeId > 0
            ? await _ds.GetProcedureActionTypeByIdAsync(p.ProcedureActionTypeId)
            : null;
        var tpl = p.FormTemplateId > 0
            ? await _ds.GetFormTemplateByIdAsync(p.FormTemplateId)
            : null;

        return Json(new
        {
            success = true,
            data = new
            {
                p.Id,
                p.Code,
                p.Name,
                p.Objectives,
                p.RegulationsAttachmentsJson,
                p.ProcedureActionTypeId,
                p.FormTemplateId,
                ProcedureActionTypeName = pat?.Name ?? "",
                FormTemplateName = tpl?.Name ?? "",
                VersionLabel = string.IsNullOrWhiteSpace(p.VersionLabel) ? "V1.0" : p.VersionLabel.Trim(),
                p.VersionRootProcedureId,
                p.UsedFormDefinitionsJson,
                p.ExecutorBeneficiaryIdsJson,
                p.UsageFrequency,
                p.ProcedureClassification,
                p.ConfidentialityLevel,
                p.ValidityType,
                ValidityStartDate = p.ValidityStartDate?.ToString("yyyy-MM-dd"),
                ValidityEndDate = p.ValidityEndDate?.ToString("yyyy-MM-dd"),
                p.OrganizationalUnitId,
                p.TargetOrganizationalUnitIdsJson,
                p.TargetBeneficiaryIdsJson,
                p.PreviousProcedureIdsJson,
                p.NextProcedureIdsJson,
                p.ImplicitProcedureIdsJson,
                p.AdditionalInputs,
                p.AdditionalOutputs,
                p.Status,
                p.RejectionReason,
                IsActive = DataService.GetEffectiveIsActive(p),
                p.CreatedBy,
                p.UpdatedBy,
                p.ApprovedBy,
                CreatedAt = p.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
                UpdatedAt = p.UpdatedAt?.ToString("yyyy-MM-dd HH:mm"),
                ApprovedAt = p.ApprovedAt?.ToString("yyyy-MM-dd HH:mm"),
                OrgUnitName = unitsAll.FirstOrDefault(u => u.Id == p.OrganizationalUnitId)?.Name ?? "",
                WorkflowStepsJson = p.WorkflowStepsJson ?? "[]"
            },
            usedFormPickerExtras
        });
    }

    [HttpPost]
    public async Task<IActionResult> UploadRegulationAttachment(IFormFile file)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        if (file == null || file.Length == 0)
            return Json(new { success = false, message = "لم يتم اختيار ملف" });

        var allowed = new[]
        {
            "image/jpeg", "image/png", "image/gif", "image/webp",
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "text/plain"
        };
        var ct = file.ContentType.ToLower();
        if (!allowed.Contains(ct))
            return Json(new { success = false, message = "نوع الملف غير مدعوم" });
        if (file.Length > 10_000_000)
            return Json(new { success = false, message = "حجم الملف يتجاوز 10 MB" });

        var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "work-procedures");
        Directory.CreateDirectory(uploadsDir);
        var ext = Path.GetExtension(file.FileName);
        var fileName = $"{Guid.NewGuid()}{ext}";
        var filePath = Path.Combine(uploadsDir, fileName);
        await using (var stream = System.IO.File.Create(filePath))
            await file.CopyToAsync(stream);

        return Json(new
        {
            success = true,
            url = $"/uploads/work-procedures/{fileName}",
            path = $"/uploads/work-procedures/{fileName}",
            name = file.FileName
        });
    }

    private static readonly JsonSerializerOptions WorkflowJsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        WriteIndented = false
    };

    [HttpGet]
    public async Task<IActionResult> GetWorkflowContext(int workProcedureId)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        var p = await _ds.GetWorkProcedureByIdAsync(workProcedureId);
        if (p == null) return Json(new { success = false, message = "غير موجود" });

        var isAdmin = CurrentUserRole == "Admin";
        var unitsAll = await _ds.ListOrganizationalUnitsAsync();
        var myOrgUnitId = await GetCreatorOrgUnitIdAsync();
        var allowedOrgIds = DescendantOrgUnitIdsIncludingSelf(myOrgUnitId, unitsAll);
        if (!CanUserAccessWorkProcedure(p, isAdmin, CurrentUserFullName, allowedOrgIds))
            return Json(new { success = false, message = "غير مصرح" });

        var procBenIds = ParseProcedureBeneficiaryIds(p);
        var allRoles = await _ds.ListExecutorRolesAsync();
        var beneficiariesAll = await _ds.ListBeneficiariesAsync();
        var allowedExecutorRoles = allRoles
            .Where(r => r.IsActive && IsExecutorRoleFullySelectedForProcedure(r, procBenIds))
            .OrderBy(r => r.SortOrder)
            .Select(r => new
            {
                id = r.Id,
                name = r.Name,
                beneficiaryIds = ParseCsvIntIds(r.ExecutorIds),
                isManagerLike = IsExecutorRoleManagerLike(r, procBenIds, beneficiariesAll)
            })
            .ToList();

        var usedFdIds = ParseUsedFormDefinitionIds(p);
        var fdAll = await _ds.ListFormDefinitionsAsync();
        var formDefinitions = fdAll
            .Where(f => usedFdIds.Contains(f.Id))
            .OrderBy(f => f.Name)
            .Select(f =>
            {
                var sections = WorkflowSectionHelper.ParseSections(f.FieldsJson)
                    .Select(s => new { id = s.Id, title = s.Title })
                    .ToList();
                return new { id = f.Id, name = f.Name, sections };
            })
            .ToList();

        var statuses = (await _ds.ListFormStatusesAsync())
            .Where(s => s.IsActive)
            .OrderBy(s => s.SortOrder)
            .Select(s => new { id = s.Id, name = s.Name, statusCategory = s.StatusCategory })
            .ToList();

        var procBeneficiaries = beneficiariesAll
            .Where(b => procBenIds.Contains(b.Id))
            .Select(b => new { id = b.Id, fullName = b.FullName, isUnitManager = b.IsUnitManager, mainRole = b.MainRole })
            .ToList();

        List<WorkflowStepSaveDto> steps;
        try
        {
            steps = JsonSerializer.Deserialize<List<WorkflowStepSaveDto>>(p.WorkflowStepsJson ?? "[]", WorkflowJsonOpts) ?? new();
        }
        catch
        {
            steps = new();
        }

        steps = steps.OrderBy(s => s.SortOrder).ToList();

        var orgUnits = DataService.FilterEffectivelyActiveOrganizationalUnits(unitsAll)
            .Select(u => new { id = u.Id, name = u.Name, parentId = u.ParentId })
            .ToList();

        var fixedAssigneeTypes = new[]
        {
            new { code = "employee", name = "الموظف", needsOrgUnit = false },
            new { code = "direct_manager", name = "المدير المباشر", needsOrgUnit = false },
            new { code = "managers_chain", name = "سلسلة المدراء المباشرين", needsOrgUnit = false },
            new { code = "unit_manager", name = "مدير الوحدة التنظيمية", needsOrgUnit = true },
            new { code = "unit_representative", name = "ممثل الوحدة التنظيمية", needsOrgUnit = true },
            new { code = "system_admin", name = "مدير النظام", needsOrgUnit = false }
        };

        var allowedStepActions = new[]
        {
            new { code = "approve", name = "موافقة", color = "#16a34a" },
            new { code = "reject", name = "رفض", color = "#dc2626" },
            new { code = "return", name = "إرجاع", color = "#1d4ed8" },
            new { code = "concurrent_approvals", name = "موافقات متزامنة", color = "#3b82f6" },
            new { code = "reassign", name = "إعادة تعيين", color = "#111827" },
            new { code = "request_clarification", name = "طلب توضيح", color = "#ca8a04" }
        };

        return Json(new
        {
            success = true,
            workProcedureId = p.Id,
            procedureCode = p.Code,
            procedureName = p.Name,
            steps,
            allowedExecutorRoles,
            formDefinitions,
            formStatuses = statuses,
            procBeneficiaries,
            organizationalUnits = orgUnits,
            fixedAssigneeTypes,
            allowedStepActions
        });
    }

    [HttpPost]
    public async Task<IActionResult> SaveWorkflowSteps([FromBody] SaveWorkflowStepsRequest req)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        if (req.WorkProcedureId <= 0) return Json(new { success = false, message = "معرّف الإجراء غير صالح" });

        var p = await _ds.GetWorkProcedureByIdAsync(req.WorkProcedureId);
        if (p == null) return Json(new { success = false, message = "غير موجود" });

        var isAdmin = CurrentUserRole == "Admin";
        var unitsAll = await _ds.ListOrganizationalUnitsAsync();
        var myOrgUnitId = await GetCreatorOrgUnitIdAsync();
        var allowedOrgIds = DescendantOrgUnitIdsIncludingSelf(myOrgUnitId, unitsAll);
        if (!CanUserAccessWorkProcedure(p, isAdmin, CurrentUserFullName, allowedOrgIds))
            return Json(new { success = false, message = "غير مصرح" });

        var beneficiariesAll = await _ds.ListBeneficiariesAsync();
        var fdAll = await _ds.ListFormDefinitionsAsync();
        var err = ValidateWorkflowStepsPayload(p, req.Steps ?? new(), beneficiariesAll, await _ds.ListExecutorRolesAsync(), fdAll, await _ds.ListFormStatusesAsync(), unitsAll);
        if (err != null) return Json(new { success = false, message = err });

        var normalized = NormalizeWorkflowStepsForSave(p, req.Steps ?? new(), beneficiariesAll, await _ds.ListExecutorRolesAsync(), fdAll);
        p.WorkflowStepsJson = JsonSerializer.Serialize(normalized, WorkflowJsonOpts);
        p.UpdatedBy = CurrentUserFullName;
        p.UpdatedAt = DateTime.Now;
        await _ds.UpdateWorkProcedureAsync(p);
        await _ds.AddAuditLogAsync(BuildAuditEntry("تحديث سير عمل الإجراء", "WorkProcedure", p.Id.ToString(), p.Name));
        return Json(new { success = true });
    }

    /// <summary>دور منفذين يضمّ على الأقل مستفيداً معلّماً كمدير وحدة تنظيمية — مطلوب لتفعيل «خطوة متزامنة».</summary>
    private static bool IsExecutorRoleManagerLike(ExecutorRole role, HashSet<int> procBenIds, List<Beneficiary> beneficiaries)
    {
        foreach (var bid in ParseCsvIntIds(role.ExecutorIds).Where(procBenIds.Contains))
        {
            var b = beneficiaries.FirstOrDefault(x => x.Id == bid);
            if (b is { IsUnitManager: true })
                return true;
        }
        return false;
    }

    private static List<int> ParseUsedFormDefinitionIds(WorkProcedure p)
    {
        var result = new List<int>();
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(p.UsedFormDefinitionsJson) ? "[]" : p.UsedFormDefinitionsJson);
            foreach (var el in doc.RootElement.EnumerateArray())
            {
                if (el.TryGetProperty("formDefinitionId", out var fd) && fd.ValueKind == JsonValueKind.Number)
                    result.Add(fd.GetInt32());
            }
        }
        catch { /* ignore */ }
        return result;
    }

    private static readonly HashSet<string> AllowedFixedAssigneeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "employee", "direct_manager", "managers_chain", "unit_manager", "unit_representative", "system_admin"
    };

    private static readonly HashSet<string> AllowedStepActionCodes = new(StringComparer.OrdinalIgnoreCase)
    {
        "approve", "reject", "return", "concurrent_approvals", "reassign", "request_clarification"
    };

    private static readonly HashSet<string> AllowedNotificationChannels = new(StringComparer.OrdinalIgnoreCase)
    {
        "in_app", "email", "sms"
    };

    private string? ValidateWorkflowStepsPayload(
        WorkProcedure p,
        List<WorkflowStepSaveDto> steps,
        List<Beneficiary> beneficiariesAll,
        List<ExecutorRole> allRoles,
        List<FormDefinition> fdAll,
        List<FormStatus> fsAll,
        List<OrganizationalUnit> unitsAll)
    {
        var procBenIds = ParseProcedureBeneficiaryIds(p);
        var allowedRoleIds = allRoles
            .Where(r => r.IsActive && IsExecutorRoleFullySelectedForProcedure(r, procBenIds))
            .Select(r => r.Id)
            .ToHashSet();
        var usedFdIds = ParseUsedFormDefinitionIds(p).ToHashSet();
        var fsIds = fsAll.Where(s => s.IsActive).Select(s => s.Id).ToHashSet();
        var orgUnitIds = DataService.FilterEffectivelyActiveOrganizationalUnits(unitsAll).Select(u => u.Id).ToHashSet();
        var ids = steps.Select(s => s.Id).ToList();
        if (ids.Any(x => x <= 0)) return "معرّف كل خطوة يجب أن يكون أكبر من صفر";
        if (ids.Count != ids.Distinct().Count()) return "معرّفات الخطوات يجب أن تكون فريدة";

        var idSet = ids.ToHashSet();
        foreach (var st in steps)
        {
            var assigneeMode = string.IsNullOrWhiteSpace(st.AssigneeMode) ? "specific" : st.AssigneeMode.Trim().ToLowerInvariant();
            if (st.IsDecision)
            {
                if (st.ExecutorRoleId <= 0 || !allowedRoleIds.Contains(st.ExecutorRoleId))
                    return "المنفذ غير مسموح لهذا الإجراء";
                if (!st.ReturnStepId.HasValue || st.ReturnStepId.Value <= 0 || !idSet.Contains(st.ReturnStepId.Value))
                    return "خطوة الرجوع مطلوبة لخطوة القرار";
            }
            else
            {
                if (string.IsNullOrWhiteSpace(st.StepLabel))
                    return "اسم الخطوة مطلوب";

                if (assigneeMode == "specific")
                {
                    if (st.ExecutorRoleId <= 0 || !allowedRoleIds.Contains(st.ExecutorRoleId))
                        return "المنفذ غير مسموح لهذا الإجراء";
                }
                else if (assigneeMode == "fixed")
                {
                    var ft = (st.AssigneeFixedType ?? "").Trim().ToLowerInvariant();
                    if (string.IsNullOrEmpty(ft) || !AllowedFixedAssigneeTypes.Contains(ft))
                        return "نوع المنفذ الثابت غير صالح";
                    if (ft is "unit_manager" or "unit_representative")
                    {
                        if (!st.AssigneeOrgUnitId.HasValue || st.AssigneeOrgUnitId.Value <= 0
                            || !orgUnitIds.Contains(st.AssigneeOrgUnitId.Value))
                            return "الوحدة التنظيمية للمنفذ مطلوبة";
                    }
                }
                else
                {
                    return "نوع المكلّف بالخطوة غير صالح";
                }

                if (!string.IsNullOrWhiteSpace(st.ExpectedDurationHours))
                {
                    if (int.TryParse(st.ExpectedDurationHours.Trim(), out var h) && (h < 0 || h > 24))
                        return "الساعات يجب أن تكون بين 0 و 24";
                }
            }

            if (st.ProgressStepId.HasValue && st.ProgressStepId.Value > 0 && !idSet.Contains(st.ProgressStepId.Value))
                return "خطوة التقدم غير موجودة";
            if (st.ReturnStepId.HasValue && st.ReturnStepId.Value > 0 && !idSet.Contains(st.ReturnStepId.Value))
                return "خطوة الرجوع غير موجودة";
            if (st.ConcurrentStepId.HasValue && st.ConcurrentStepId.Value > 0 && !idSet.Contains(st.ConcurrentStepId.Value))
                return "خطوة التزامن غير موجودة";

            if (!st.IsDecision)
            {
                var fdById = fdAll.ToDictionary(f => f.Id);
                var (resolvedFd, resolvedSec) = WorkflowSectionHelper.ResolveStepBinding(
                    st.FormDefinitionId, st.FormSectionId, usedFdIds.ToList(), fdById);

                if (usedFdIds.Count > 1 && (!resolvedFd.HasValue || resolvedFd.Value <= 0))
                    return $"يجب اختيار النموذج في خطوة «{st.StepLabel}» عند وجود أكثر من نموذج مستخدم";

                if (resolvedFd.HasValue && resolvedFd.Value > 0 && fdById.TryGetValue(resolvedFd.Value, out var fdRow))
                {
                    var sectionList = WorkflowSectionHelper.ParseSections(fdRow.FieldsJson);
                    if (sectionList.Count > 1 && (!resolvedSec.HasValue || resolvedSec.Value <= 0))
                        return $"يجب اختيار القسم في خطوة «{st.StepLabel}»";
                    if (st.FormSectionId.HasValue && st.FormSectionId.Value > 0)
                    {
                        var sectionIds = sectionList.Select(s => s.Id).ToHashSet();
                        if (!sectionIds.Contains(st.FormSectionId.Value))
                            return "القسم المختار غير موجود في النموذج";
                    }
                }

                if (st.FormDefinitionId.HasValue && st.FormDefinitionId.Value > 0 && !usedFdIds.Contains(st.FormDefinitionId.Value))
                    return "النموذج المختار غير ضمن النماذج المستخدمة للإجراء";
                if (st.FormStatusId.HasValue && st.FormStatusId.Value > 0 && !fsIds.Contains(st.FormStatusId.Value))
                    return "الحالة غير صالحة";

                if (assigneeMode == "specific" || assigneeMode == "fixed")
                {
                    if (st.AllowedActions != null && st.AllowedActions.Count > 0)
                    {
                        foreach (var a in st.AllowedActions)
                        {
                            if (!string.IsNullOrWhiteSpace(a) && !AllowedStepActionCodes.Contains(a.Trim()))
                                return "إجراء غير صالح ضمن الإجراءات المسموحة";
                        }
                        var hasReturn = st.AllowedActions.Any(a => string.Equals(a?.Trim(), "return", StringComparison.OrdinalIgnoreCase));
                        if (hasReturn && (!st.ReturnStepId.HasValue || st.ReturnStepId.Value <= 0))
                            return "خطوة الرجوع مطلوبة عند تفعيل إجراء «إرجاع»";
                        var hasConcurrent = st.AllowedActions.Any(a => string.Equals(a?.Trim(), "concurrent_approvals", StringComparison.OrdinalIgnoreCase));
                        if (hasConcurrent && (!st.ConcurrentStepId.HasValue || st.ConcurrentStepId.Value <= 0))
                            return "خطوة التزامن مطلوبة عند تفعيل «موافقات متزامنة»";
                    }
                    // الحالة إلزامية للخطوات غير القرارية
                    if (!st.FormStatusId.HasValue || st.FormStatusId.Value <= 0)
                        return "الحالة مطلوبة";
                }
            }

            if (st.NotificationChannels != null && st.NotificationChannels.Count > 0)
            {
                foreach (var ch in st.NotificationChannels)
                {
                    if (!string.IsNullOrWhiteSpace(ch) && !AllowedNotificationChannels.Contains(ch.Trim()))
                        return "قناة الإشعار غير صالحة";
                }
            }
            else if (!string.IsNullOrWhiteSpace(st.NotificationChannel))
            {
                var ch = st.NotificationChannel.Trim().ToLowerInvariant();
                if (!AllowedNotificationChannels.Contains(ch))
                    return "قناة الإشعار غير صالحة";
            }
        }

        return null;
    }

    private static List<WorkflowStepSaveDto> NormalizeWorkflowStepsForSave(
        WorkProcedure p,
        List<WorkflowStepSaveDto> steps,
        List<Beneficiary> beneficiariesAll,
        List<ExecutorRole> allRoles,
        List<FormDefinition> fdAll)
    {
        var procBenIds = ParseProcedureBeneficiaryIds(p);
        var usedIds = ParseUsedFormDefinitionIds(p).ToList();
        var fdById = fdAll.ToDictionary(f => f.Id);
        var ordered = steps.OrderBy(s => s.SortOrder).ToList();
        var result = new List<WorkflowStepSaveDto>();
        foreach (var st in ordered)
        {
            var assigneeMode = string.IsNullOrWhiteSpace(st.AssigneeMode) ? "specific" : st.AssigneeMode.Trim().ToLowerInvariant();
            if (assigneeMode != "fixed") assigneeMode = "specific";
            var fixedType = (st.AssigneeFixedType ?? "").Trim().ToLowerInvariant();

            // Channels: list takes priority. If list empty, fall back to single channel.
            List<string>? normalizedChannels = null;
            if (st.NotificationChannels != null && st.NotificationChannels.Count > 0)
            {
                normalizedChannels = st.NotificationChannels
                    .Where(x => !string.IsNullOrWhiteSpace(x))
                    .Select(x => x.Trim().ToLowerInvariant())
                    .Where(AllowedNotificationChannels.Contains)
                    .Distinct()
                    .ToList();
                if (normalizedChannels.Count == 0) normalizedChannels = null;
            }
            var primaryChannel = normalizedChannels != null && normalizedChannels.Count > 0
                ? normalizedChannels.First()
                : (string.IsNullOrWhiteSpace(st.NotificationChannel) ? "" : st.NotificationChannel.Trim().ToLowerInvariant());

            List<string>? normalizedActions = null;
            if (st.AllowedActions != null && st.AllowedActions.Count > 0)
            {
                normalizedActions = st.AllowedActions
                    .Where(x => !string.IsNullOrWhiteSpace(x))
                    .Select(x => x.Trim().ToLowerInvariant())
                    .Where(AllowedStepActionCodes.Contains)
                    .Distinct()
                    .ToList();
                if (normalizedActions.Count == 0) normalizedActions = null;
            }

            var (resolvedFd, resolvedSec) = WorkflowSectionHelper.ResolveStepBinding(
                st.FormDefinitionId, st.FormSectionId, usedIds, fdById);

            var copy = new WorkflowStepSaveDto
            {
                Id = st.Id,
                SortOrder = st.SortOrder,
                IsDecision = st.IsDecision,
                StepLabel = st.IsDecision ? "قرار" : (st.StepLabel ?? "").Trim(),
                ExecutorRoleId = assigneeMode == "specific" ? st.ExecutorRoleId : 0,
                ExpectedDurationDays = st.ExpectedDurationDays?.Trim() ?? "",
                ExpectedDurationHours = st.ExpectedDurationHours?.Trim() ?? "",
                IsConcurrentStep = st.IsConcurrentStep,
                EscalationSyncFlags = st.EscalationSyncFlags,
                ReturnStepId = st.ReturnStepId,
                ProgressStepId = st.ProgressStepId,
                FormDefinitionId = resolvedFd,
                FormSectionId = resolvedSec,
                FormStatusId = st.FormStatusId,
                NotificationChannel = primaryChannel,
                NotificationChannels = normalizedChannels,
                OverdueNotificationText = st.OverdueNotificationText?.Trim() ?? "",
                ExecutionNotificationText = st.ExecutionNotificationText?.Trim() ?? "",
                Notes = st.Notes?.Trim(),
                AssigneeMode = assigneeMode,
                AssigneeFixedType = assigneeMode == "fixed" ? fixedType : "",
                AssigneeOrgUnitId = (assigneeMode == "fixed" && (fixedType is "unit_manager" or "unit_representative"))
                    ? st.AssigneeOrgUnitId
                    : null,
                AllowedActions = normalizedActions,
                ConcurrentStepId = (normalizedActions != null && normalizedActions.Contains("concurrent_approvals"))
                    ? st.ConcurrentStepId
                    : null
            };
            if (copy.IsDecision)
            {
                copy.ExpectedDurationDays = "";
                copy.ExpectedDurationHours = "";
                copy.IsConcurrentStep = false;
                copy.EscalationSyncFlags = null;
                copy.FormDefinitionId = null;
                copy.FormSectionId = null;
                copy.FormStatusId = null;
                copy.NotificationChannel = "in_app";
                copy.NotificationChannels = null;
                copy.OverdueNotificationText = "";
                copy.ExecutionNotificationText = "";
            }
            else if (!copy.FormDefinitionId.HasValue || copy.FormDefinitionId.Value <= 0)
            {
                copy.FormSectionId = null;
            }
            else if (copy.AssigneeMode == "specific")
            {
                var role = allRoles.FirstOrDefault(r => r.Id == copy.ExecutorRoleId);
                if (role == null || !IsExecutorRoleManagerLike(role, procBenIds, beneficiariesAll))
                {
                    copy.IsConcurrentStep = false;
                    copy.EscalationSyncFlags = null;
                }
            }
            // إذا لم تحتوِ AllowedActions على «إرجاع» نفرّغ ReturnStepId المرتبط بهذا الإجراء
            if (!copy.IsDecision)
            {
                var hasReturn = copy.AllowedActions?.Contains("return") == true;
                if (!hasReturn) copy.ReturnStepId = null;
            }
            result.Add(copy);
        }
        return result;
    }

    [HttpPost]
    public async Task<IActionResult> AddWorkProcedure([FromBody] WorkProcedureRequest req)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        if (CurrentUserRole != "Admin" && CurrentUserRole != "Employee")
            return Json(new { success = false, message = "غير مصرح" });

        var err = ValidateWorkProcedureRequest(req, true);
        if (err != null) return Json(new { success = false, message = err });

        var patTplErr = await ValidateProcedureActionTypeAndTemplateAsync(req.ProcedureActionTypeId, req.FormTemplateId);
        if (patTplErr != null) return Json(new { success = false, message = patTplErr });

        var isVersionMode = req.BaseProcedureId.HasValue && req.BaseProcedureId.Value > 0;
        if (!isVersionMode)
        {
            var uniqErrAdd = await ValidateCodeNameUniqueAsync(req.Code, req.Name, null);
            if (uniqErrAdd != null) return Json(new { success = false, message = uniqErrAdd });
        }

        var isAdmin = CurrentUserRole == "Admin";
        var unitsAll = await _ds.ListOrganizationalUnitsAsync();
        var myOrgUnitId = await GetCreatorOrgUnitIdAsync();
        var allowedOrgIds = DescendantOrgUnitIdsIncludingSelf(myOrgUnitId, unitsAll);

        if (!isAdmin)
            req.OrganizationalUnitId = myOrgUnitId;

        var usedErr = await ValidateUsedFormsAsync(req.UsedForms, isAdmin, myOrgUnitId, req.OrganizationalUnitId, grandfatheredUsedFormDefIds: null);
        if (usedErr != null) return Json(new { success = false, message = usedErr });
        var execErr = await ValidateExecutorBeneficiaryIdsAsync(req.ExecutorBeneficiaryIds, isAdmin, allowedOrgIds);
        if (execErr != null) return Json(new { success = false, message = execErr });
        var relErr = await ValidateProcedureRelationsAsync(null, req.PreviousProcedureIds, req.NextProcedureIds, req.ImplicitProcedureIds, isAdmin, allowedOrgIds);
        if (relErr != null) return Json(new { success = false, message = relErr });

        if (isAdmin)
        {
            var ou = unitsAll.FirstOrDefault(u => u.Id == req.OrganizationalUnitId);
            if (ou == null || !ou.IsActive)
                return Json(new { success = false, message = "الوحدة المالكة غير صالحة" });
        }

        if (!ValidateTargetOrganizationalUnitsActive(req.TargetOrganizationalUnitIds ?? new List<int>(), unitsAll))
            return Json(new { success = false, message = "إحدى الوحدات المستهدفة غير موجودة أو غير مفعّلة" });

        var tgtBenErr = await ValidateTargetBeneficiaryIdsAsync(req.TargetBeneficiaryIds, req.TargetOrganizationalUnitIds ?? new List<int>());
        if (tgtBenErr != null) return Json(new { success = false, message = tgtBenErr });

        req.WorkspaceId = 0;

        WorkProcedure? versionSource = null;
        if (isVersionMode)
        {
            versionSource = await _ds.GetWorkProcedureByIdAsync(req.BaseProcedureId!.Value);
            if (versionSource == null)
                return Json(new { success = false, message = "الإجراء المرجعي للإصدار غير موجود" });
            if (!CanUserAccessWorkProcedure(versionSource, isAdmin, CurrentUserFullName, allowedOrgIds))
                return Json(new { success = false, message = "غير مصرح بإنشاء إصدار من هذا الإجراء" });
        }

        var send = req.SendForApproval;
        var w = BuildEntityFromRequest(req, new WorkProcedure(), isAdmin, send);
        w.CreatedBy = CurrentUserFullName;

        if (send)
        {
            var wfErr = ValidateWorkflowStepsForPublish(w.WorkflowStepsJson);
            if (wfErr != null) return Json(new { success = false, message = wfErr });
        }

        if (versionSource != null)
        {
            var rootId = versionSource.VersionRootProcedureId > 0 ? versionSource.VersionRootProcedureId : versionSource.Id;
            w.VersionRootProcedureId = rootId;
            w.VersionLabel = await ComputeNextWorkProcedureVersionLabelAsync(rootId);
            // ترميز ثابت: نلتزم بترميز الإجراء المصدر لتسلسل الإصدارات
            w.Code = versionSource.Code;
        }

        var created = await _ds.AddWorkProcedureAsync(w);
        if (versionSource != null && created.Status == "approved" && created.IsActive)
        {
            await DeactivateOtherVersionsAsync(created);
        }
        await _ds.AddAuditLogAsync(BuildAuditEntry(
            isVersionMode ? "إضافة إصدار جديد لإجراء عمل" : "إضافة إجراء عمل",
            "WorkProcedure",
            created.Id.ToString(),
            req.Name));
        return Json(new { success = true, id = created.Id });
    }

    /// <summary>عند تفعيل إصدار جديد ضمن سلسلة Root، يُعطَّل بقية الإصدارات تلقائياً.</summary>
    private async Task DeactivateOtherVersionsAsync(WorkProcedure activated)
    {
        var rootId = activated.VersionRootProcedureId > 0 ? activated.VersionRootProcedureId : activated.Id;
        if (rootId <= 0) return;
        var all = await _ds.ListWorkProceduresAsync();
        foreach (var p in all)
        {
            if (p.Id == activated.Id) continue;
            var pRoot = p.VersionRootProcedureId > 0 ? p.VersionRootProcedureId : p.Id;
            if (pRoot != rootId) continue;
            if (!p.IsActive) continue;
            p.IsActive = false;
            p.UpdatedBy = CurrentUserFullName;
            p.UpdatedAt = DateTime.Now;
            await _ds.UpdateWorkProcedureAsync(p);
            await _ds.AddAuditLogAsync(BuildAuditEntry(
                "تعطيل تلقائي لإصدار سابق",
                "WorkProcedure",
                p.Id.ToString(),
                p.Name));
        }
    }

    [HttpPost]
    public async Task<IActionResult> UpdateWorkProcedure([FromBody] WorkProcedureUpdateRequest req)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        var p = await _ds.GetWorkProcedureByIdAsync(req.Id);
        if (p == null) return Json(new { success = false, message = "غير موجود" });
        if (p.Status == "approved" && CurrentUserRole != "Admin")
            return Json(new { success = false, message = "لا يمكن تعديل إجراء معتمد" });

        var err = ValidateWorkProcedureRequest(req, true);
        if (err != null) return Json(new { success = false, message = err });

        var patTplErr = await ValidateProcedureActionTypeAndTemplateAsync(req.ProcedureActionTypeId, req.FormTemplateId);
        if (patTplErr != null) return Json(new { success = false, message = patTplErr });

        var uniqErr = await ValidateCodeNameUniqueIgnoringVersionFamilyAsync(req.Code, req.Name, p);
        if (uniqErr != null) return Json(new { success = false, message = uniqErr });

        var isAdmin = CurrentUserRole == "Admin";
        var unitsAll = await _ds.ListOrganizationalUnitsAsync();
        var myOrgUnitId = await GetCreatorOrgUnitIdAsync();
        var allowedOrgIds = DescendantOrgUnitIdsIncludingSelf(myOrgUnitId, unitsAll);

        if (!CanUserAccessWorkProcedure(p, isAdmin, CurrentUserFullName, allowedOrgIds))
            return Json(new { success = false, message = "غير مصرح" });

        if (!isAdmin)
            req.OrganizationalUnitId = p.OrganizationalUnitId;

        var usedErr = await ValidateUsedFormsAsync(req.UsedForms, isAdmin, myOrgUnitId, req.OrganizationalUnitId, ParseUsedFormDefinitionIds(p).ToHashSet());
        if (usedErr != null) return Json(new { success = false, message = usedErr });
        var execErr = await ValidateExecutorBeneficiaryIdsAsync(req.ExecutorBeneficiaryIds, isAdmin, allowedOrgIds);
        if (execErr != null) return Json(new { success = false, message = execErr });
        var relErr = await ValidateProcedureRelationsAsync(req.Id, req.PreviousProcedureIds, req.NextProcedureIds, req.ImplicitProcedureIds, isAdmin, allowedOrgIds);
        if (relErr != null) return Json(new { success = false, message = relErr });

        if (isAdmin)
        {
            var ou = unitsAll.FirstOrDefault(u => u.Id == req.OrganizationalUnitId);
            if (ou == null || !ou.IsActive)
                return Json(new { success = false, message = "الوحدة المالكة غير صالحة" });
        }

        if (!ValidateTargetOrganizationalUnitsActive(req.TargetOrganizationalUnitIds ?? new List<int>(), unitsAll))
            return Json(new { success = false, message = "إحدى الوحدات المستهدفة غير موجودة أو غير مفعّلة" });

        var tgtBenErr = await ValidateTargetBeneficiaryIdsAsync(req.TargetBeneficiaryIds, req.TargetOrganizationalUnitIds ?? new List<int>());
        if (tgtBenErr != null) return Json(new { success = false, message = tgtBenErr });

        req.WorkspaceId = 0;

        BuildEntityFromRequest(req, p, isAdmin, req.SendForApproval);
        p.UpdatedBy = CurrentUserFullName;
        p.UpdatedAt = DateTime.Now;

        if (req.SendForApproval)
        {
            var wfErr = ValidateWorkflowStepsForPublish(p.WorkflowStepsJson);
            if (wfErr != null) return Json(new { success = false, message = wfErr });

            if (isAdmin)
            {
                p.Status = "approved";
                p.RejectionReason = "";
                p.ApprovedBy = CurrentUserFullName;
                p.ApprovedAt = DateTime.Now;
                p.IsActive = true;
            }
            else if (p.Status is "draft" or "rejected")
            {
                p.Status = "pending";
                p.IsActive = false;
            }
        }

        await _ds.UpdateWorkProcedureAsync(p);
        if (p.Status == "approved" && p.IsActive && p.VersionRootProcedureId > 0)
        {
            await DeactivateOtherVersionsAsync(p);
        }
        await _ds.AddAuditLogAsync(BuildAuditEntry("تعديل إجراء عمل", "WorkProcedure", p.Id.ToString(), p.Name));
        return Json(new { success = true });
    }

    [HttpPost]
    public async Task<IActionResult> DeleteWorkProcedure([FromBody] WorkProcedureIdRequest req)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        var p = await _ds.GetWorkProcedureByIdAsync(req.Id);
        if (p == null) return Json(new { success = false, message = "غير موجود" });
        if (p.Status == "approved" && CurrentUserRole != "Admin")
            return Json(new { success = false, message = "لا يمكن حذف إجراء معتمد" });

        var isAdmin = CurrentUserRole == "Admin";
        var unitsAll = await _ds.ListOrganizationalUnitsAsync();
        var myOrgUnitId = await GetCreatorOrgUnitIdAsync();
        var allowedOrgIds = DescendantOrgUnitIdsIncludingSelf(myOrgUnitId, unitsAll);
        if (!CanUserAccessWorkProcedure(p, isAdmin, CurrentUserFullName, allowedOrgIds))
            return Json(new { success = false, message = "غير مصرح" });

        if (await _ds.IsWorkProcedureLinkedAsync(req.Id))
            return Json(new { success = false, message = LinkedEntityDeleteBlockedMessage });

        await _ds.DeleteWorkProcedureAsync(req.Id);
        await _ds.AddAuditLogAsync(BuildAuditEntry("حذف إجراء عمل", "WorkProcedure", req.Id.ToString(), p.Name));
        return Json(new { success = true });
    }

    [HttpPost]
    public async Task<IActionResult> SubmitForApproval([FromBody] WorkProcedureIdRequest req)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        var p = await _ds.GetWorkProcedureByIdAsync(req.Id);
        if (p == null) return Json(new { success = false, message = "غير موجود" });
        if (p.Status != "draft" && p.Status != "rejected")
            return Json(new { success = false, message = "لا يمكن إرساله للاعتماد بالحالة الحالية" });

        p.Status = "pending";
        p.RejectionReason = "";
        p.UpdatedBy = CurrentUserFullName;
        p.UpdatedAt = DateTime.Now;
        await _ds.UpdateWorkProcedureAsync(p);
        await _ds.AddAuditLogAsync(BuildAuditEntry("إرسال للاعتماد", "WorkProcedure", p.Id.ToString(), p.Name));
        return Json(new { success = true });
    }

    [HttpPost]
    public async Task<IActionResult> ApproveWorkProcedure([FromBody] WorkProcedureIdRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });
        var p = await _ds.GetWorkProcedureByIdAsync(req.Id);
        if (p == null) return Json(new { success = false, message = "غير موجود" });

        p.Status = "approved";
        p.RejectionReason = "";
        p.ApprovedBy = CurrentUserFullName;
        p.ApprovedAt = DateTime.Now;
        p.UpdatedBy = CurrentUserFullName;
        p.UpdatedAt = DateTime.Now;
        await _ds.UpdateWorkProcedureAsync(p);
        await _ds.AddAuditLogAsync(BuildAuditEntry("اعتماد إجراء عمل", "WorkProcedure", p.Id.ToString(), p.Name));
        return Json(new { success = true });
    }

    [HttpPost]
    public async Task<IActionResult> RejectWorkProcedure([FromBody] WorkProcedureRejectRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });
        var p = await _ds.GetWorkProcedureByIdAsync(req.Id);
        if (p == null) return Json(new { success = false, message = "غير موجود" });

        p.Status = "rejected";
        p.RejectionReason = req.Reason ?? "";
        p.UpdatedBy = CurrentUserFullName;
        p.UpdatedAt = DateTime.Now;
        await _ds.UpdateWorkProcedureAsync(p);
        await _ds.AddAuditLogAsync(BuildAuditEntry("رفض إجراء عمل", "WorkProcedure", p.Id.ToString(), p.Name));
        return Json(new { success = true });
    }

    [HttpPost]
    public async Task<IActionResult> ToggleWorkProcedure([FromBody] WorkProcedureIdRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });
        await ApplyAutoCloseExpiredAsync();
        var p = await _ds.GetWorkProcedureByIdAsync(req.Id);
        if (p == null) return Json(new { success = false, message = "غير موجود" });
        if (p.Status != "approved")
            return Json(new { success = false, message = "يمكن التفعيل فقط للإجراءات المعتمدة" });

        p.IsActive = !p.IsActive;
        p.UpdatedBy = CurrentUserFullName;
        p.UpdatedAt = DateTime.Now;
        await _ds.UpdateWorkProcedureAsync(p);
        if (p.IsActive)
        {
            await DeactivateOtherVersionsAsync(p);
        }
        return Json(new { success = true, isActive = p.IsActive });
    }

    [HttpPost]
    public async Task<IActionResult> GetBeneficiariesByOrgUnits([FromBody] OrgUnitsBeneficiariesRequest req)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        var ids = (req.OrganizationalUnitIds ?? new List<int>()).Where(x => x > 0).Distinct().ToList();
        if (ids.Count == 0)
            return Json(new { success = true, data = new List<object>() });

        var unitsAll = await _ds.ListOrganizationalUnitsAsync();
        var activeUnitIds = DataService.FilterEffectivelyActiveOrganizationalUnits(unitsAll).Select(u => u.Id).ToHashSet();
        var validIds = ids.Where(activeUnitIds.Contains).ToHashSet();
        var ouMap = unitsAll.ToDictionary(u => u.Id, u => u.Name);

        var beneficiaries = await _ds.ListBeneficiariesAsync();
        var data = beneficiaries
            .Where(b => b.IsActive && b.OrganizationalUnitId.HasValue && validIds.Contains(b.OrganizationalUnitId.Value))
            .OrderBy(b => b.FullName)
            .Select(b => new
            {
                id = b.Id,
                fullName = b.FullName,
                organizationalUnitId = b.OrganizationalUnitId,
                departmentName = b.OrganizationalUnitId.HasValue && ouMap.TryGetValue(b.OrganizationalUnitId.Value, out var ouName)
                    ? ouName
                    : "",
                isUnitManager = b.IsUnitManager
            })
            .ToList();
        return Json(new { success = true, data });
    }

    [HttpGet]
    public async Task<IActionResult> ListRelatedProcedures(int? excludeId, bool approvedOnly = false, bool activeOnly = true)
    {
        if (!IsAuthenticated) return Json(new { success = false });
        var isAdmin = CurrentUserRole == "Admin";
        var unitsAll = await _ds.ListOrganizationalUnitsAsync();
        var myOrgUnitId = await GetCreatorOrgUnitIdAsync();
        var allowedOrgIds = DescendantOrgUnitIdsIncludingSelf(myOrgUnitId, unitsAll);

        var all = await _ds.ListWorkProceduresAsync();
        if (isAdmin)
            all = WorkProcedureVisibility.FilterForAdmin(all, CurrentUserFullName).ToList();
        else
            all = all.Where(p => allowedOrgIds.Contains(p.OrganizationalUnitId)).ToList();
        if (approvedOnly)
            all = all.Where(p => p.Status == "approved").ToList();
        if (activeOnly)
            all = all.Where(IsProcedureCurrentlyActive).ToList();
        if (excludeId.HasValue && excludeId.Value > 0)
            all = all.Where(p => p.Id != excludeId.Value).ToList();

        return Json(new
        {
            success = true,
            data = all.OrderByDescending(p => p.CreatedAt).Select(p => new
            {
                p.Id,
                p.Code,
                p.Name,
                p.VersionLabel,
                p.VersionRootProcedureId,
                p.Status
            }).ToList()
        });
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    private Task ApplyAutoCloseExpiredAsync() => _ds.ApplyAutoCloseExpiredWorkProceduresAsync();

    private static bool CanUserAccessWorkProcedure(WorkProcedure p, bool isAdmin, string? userFullName, HashSet<int> allowedOrgIds)
    {
        if (isAdmin)
            return WorkProcedureVisibility.IsVisibleToAdmin(p, userFullName);
        return allowedOrgIds.Contains(p.OrganizationalUnitId);
    }

    private async Task<string?> ValidateUsedFormsAsync(List<UsedFormDefItem>? items, bool isAdmin, int myOrgUnitId, int organizationalUnitId, HashSet<int>? grandfatheredUsedFormDefIds)
    {
        if (items == null || items.Count == 0) return "النماذج المستخدمة مطلوبة";
        if (organizationalUnitId <= 0) return "الوحدة التنظيمية المالكة مطلوبة";
        var allowed = await ListFormDefinitionsForUserAsync(isAdmin, myOrgUnitId, activeApprovedOnly: false);
        var byId = allowed.ToDictionary(f => f.Id);
        foreach (var it in items)
        {
            if (it.FormDefinitionId <= 0) return "نموذج غير صالح";
            if (!byId.TryGetValue(it.FormDefinitionId, out var fd)) return "أحد النماذج المختارة غير مسموح به";
            if (fd.OrganizationalUnitId != organizationalUnitId) return "يجب أن تكون النماذج المستخدمة ضمن الوحدة التنظيمية المالكة المختارة";
            var wasAlreadyUsed = grandfatheredUsedFormDefIds != null && grandfatheredUsedFormDefIds.Contains(it.FormDefinitionId);
            if (!wasAlreadyUsed && (!FormDefinitionIsActiveApproved(fd)))
                return "يجب اختيار نماذج معتمدة ومفعّلة فقط في النماذج المستخدمة";
            var vis = string.IsNullOrWhiteSpace(it.Visibility) ? "عام" : it.Visibility.Trim();
            if (vis != "عام" && vis != "خاص") return "قيمة ظهور النموذج يجب أن تكون عام أو خاص";
        }
        return null;
    }

    private static bool FormDefinitionIsActiveApproved(FormDefinition f)
        => f.IsActive && string.Equals((f.Status ?? "").Trim(), "approved", StringComparison.OrdinalIgnoreCase);

    private async Task<List<object>> BuildUsedFormPickerExtrasAsync(WorkProcedure p, bool isAdmin, int myOrgUnitId)
    {
        var usedIds = ParseUsedFormDefinitionIds(p);
        if (usedIds.Count == 0) return new List<object>();

        var activeInPicker = await ListFormDefinitionsForUserAsync(isAdmin, myOrgUnitId, activeApprovedOnly: true);
        var activeInOu = activeInPicker.Where(f => f.OrganizationalUnitId == p.OrganizationalUnitId).Select(f => f.Id).ToHashSet();
        var fdAll = await _ds.ListFormDefinitionsAsync();
        var byId = fdAll.ToDictionary(f => f.Id);

        var list = new List<object>();
        foreach (var id in usedIds)
        {
            if (activeInOu.Contains(id)) continue;
            if (!byId.TryGetValue(id, out var f))
            {
                list.Add(new { id, name = $"نموذج #{id}", organizationalUnitId = 0 });
                continue;
            }
            var suffix = FormDefinitionIsActiveApproved(f) ? "" : " (غير مفعّل أو غير معتمد)";
            list.Add(new { id, name = f.Name + suffix, organizationalUnitId = f.OrganizationalUnitId });
        }
        return list;
    }

    private static HashSet<int> ParseProcedureBeneficiaryIds(WorkProcedure p)
    {
        try
        {
            var ids = JsonSerializer.Deserialize<List<int>>(p.ExecutorBeneficiaryIdsJson ?? "[]", JsonOpts);
            return ids?.Where(x => x > 0).ToHashSet() ?? new HashSet<int>();
        }
        catch { return new HashSet<int>(); }
    }

    private static List<int> ParseCsvIntIds(string? csv)
    {
        var list = new List<int>();
        foreach (var part in (csv ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (int.TryParse(part, out var id) && id > 0) list.Add(id);
        }
        return list;
    }

    private static HashSet<int> ParseBeneficiaryIdsFromExecutorRoles(IEnumerable<ExecutorRole> roles)
    {
        var benIds = new HashSet<int>();
        foreach (var r in roles)
        {
            if (!r.IsActive) continue;
            foreach (var part in (r.ExecutorIds ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (int.TryParse(part, out var id) && id > 0) benIds.Add(id);
            }
        }
        return benIds;
    }

    private async Task<string?> ValidateExecutorBeneficiaryIdsAsync(List<int>? ids, bool isAdmin, HashSet<int> allowedOrgIds)
    {
        if (ids == null || ids.Count == 0) return "المنفذين للإجراء مطلوبون";
        var roles = await ListExecutorRolesForProcedureExecutorsPicklistAsync(isAdmin, allowedOrgIds);
        var allowed = ParseBeneficiaryIdsFromExecutorRoles(roles);
        foreach (var id in ids)
        {
            if (id <= 0 || !allowed.Contains(id))
                return "أحد المنفذين غير مسموح به أو غير مضاف في أدوار المنفذين";
        }
        return null;
    }

    private async Task<string?> ValidateProcedureRelationsAsync(int? selfId, List<int>? prev, List<int>? next, List<int>? implicitIds, bool isAdmin, HashSet<int> allowedOrgIds)
    {
        var all = await _ds.ListWorkProceduresAsync();
        IEnumerable<int> AllIds()
        {
            if (prev != null) foreach (var x in prev) yield return x;
            if (next != null) foreach (var x in next) yield return x;
            if (implicitIds != null) foreach (var x in implicitIds) yield return x;
        }
        var allRel = new List<int>();
        if (prev != null) allRel.AddRange(prev);
        if (next != null) allRel.AddRange(next);
        if (implicitIds != null) allRel.AddRange(implicitIds);
        if (allRel.Count != allRel.Distinct().Count())
            return "لا يمكن أن يظهر نفس الإجراء في أكثر من قائمة (سابقة / لاحقة / ضمنية)";

        foreach (var id in AllIds())
        {
            if (id <= 0) return "إجراء مرتبط غير صالح";
            if (selfId.HasValue && id == selfId.Value) return "لا يمكن ربط الإجراء بنفسه";
            var o = all.FirstOrDefault(x => x.Id == id);
            if (o == null) return "إجراء مرتبط غير موجود";
            if (!IsProcedureCurrentlyActive(o))
                return "يمكن ربط الإجراءات المفعلة فقط";
            if (!CanUserAccessWorkProcedure(o, isAdmin, CurrentUserFullName, allowedOrgIds))
                return "إجراء مرتبط غير مسموح به";
        }
        return null;
    }

    private async Task<string?> ValidateProcedureActionTypeAndTemplateAsync(int procedureActionTypeId, int formTemplateId)
    {
        var pat = await _ds.GetProcedureActionTypeByIdAsync(procedureActionTypeId);
        if (pat == null || !pat.IsActive)
            return "نوع الإجراء غير صالح أو غير مفعّل";
        var tpl = await _ds.GetFormTemplateByIdAsync(formTemplateId);
        if (tpl == null || !tpl.IsActive)
            return "القالب المستخدم غير صالح أو غير مفعّل";
        return null;
    }

    private async Task<string> ComputeNextWorkProcedureVersionLabelAsync(int rootProcedureId)
    {
        var all = await _ds.ListWorkProceduresAsync();
        var family = all.Where(p =>
            p.Id == rootProcedureId ||
            (p.VersionRootProcedureId > 0 && p.VersionRootProcedureId == rootProcedureId)).ToList();
        var maxMajor = 1;
        foreach (var p in family)
        {
            var maj = ParseWorkProcedureVersionMajor(p.VersionLabel);
            if (maj > maxMajor) maxMajor = maj;
        }
        return $"V{maxMajor + 1}.0";
    }

    private static int ParseWorkProcedureVersionMajor(string? label)
    {
        if (string.IsNullOrWhiteSpace(label)) return 1;
        var m = Regex.Match(label.Trim(), "^[vV](\\d+)", RegexOptions.CultureInvariant);
        if (m.Success && int.TryParse(m.Groups[1].Value, out var n) && n > 0)
            return n;
        return 1;
    }

    private WorkProcedure BuildEntityFromRequest(WorkProcedureRequest req, WorkProcedure w, bool isAdmin, bool sendForApproval)
    {
        w.Code = req.Code.Trim();
        w.Name = req.Name.Trim();
        w.Objectives = req.Objectives?.Trim() ?? "";
        w.RegulationsAttachmentsJson = string.IsNullOrWhiteSpace(req.RegulationsAttachmentsJson) ? "[]" : req.RegulationsAttachmentsJson!;
        w.ProcedureActionTypeId = req.ProcedureActionTypeId;
        w.FormTemplateId = req.FormTemplateId;
        w.WorkspaceId = 0;
        w.UsedFormDefinitionsJson = SerializeUsedForms(req.UsedForms);
        w.ExecutorBeneficiaryIdsJson = JsonSerializer.Serialize(req.ExecutorBeneficiaryIds ?? new List<int>(), JsonOpts);
        w.UsageFrequency = req.UsageFrequency ?? "شهري";
        w.ProcedureClassification = req.ProcedureClassification ?? "رئيسي";
        w.ConfidentialityLevel = req.ConfidentialityLevel ?? "متوسط";
        w.ValidityType = req.ValidityType ?? "دائم";
        w.ValidityStartDate = w.ValidityType == "مؤقت" ? ParseDate(req.ValidityStartDate) : null;
        w.ValidityEndDate = w.ValidityType == "مؤقت" ? ParseDate(req.ValidityEndDate) : null;
        w.OrganizationalUnitId = req.OrganizationalUnitId;
        w.TargetOrganizationalUnitIdsJson = JsonSerializer.Serialize(req.TargetOrganizationalUnitIds ?? new List<int>(), JsonOpts);
        w.TargetBeneficiaryIdsJson = JsonSerializer.Serialize(req.TargetBeneficiaryIds ?? new List<int>(), JsonOpts);
        w.PreviousProcedureIdsJson = JsonSerializer.Serialize(req.PreviousProcedureIds ?? new List<int>(), JsonOpts);
        w.NextProcedureIdsJson = JsonSerializer.Serialize(req.NextProcedureIds ?? new List<int>(), JsonOpts);
        w.ImplicitProcedureIdsJson = JsonSerializer.Serialize(req.ImplicitProcedureIds ?? new List<int>(), JsonOpts);
        w.AdditionalInputs = req.AdditionalInputs?.Trim() ?? "";
        w.AdditionalOutputs = req.AdditionalOutputs?.Trim() ?? "";

        if (w.Id == 0)
        {
            w.VersionLabel = "V1.0";
            w.VersionRootProcedureId = 0;
            w.Status = sendForApproval ? (isAdmin ? "approved" : "pending") : "draft";
            w.IsActive = sendForApproval && isAdmin;
            if (isAdmin && sendForApproval)
            {
                w.ApprovedBy = CurrentUserFullName;
                w.ApprovedAt = DateTime.Now;
            }
            else
            {
                w.ApprovedBy = null;
                w.ApprovedAt = null;
            }
            w.RejectionReason = "";
        }

        return w;
    }

    private static DateTime? ParseDate(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        return DateTime.TryParse(s, out var d) ? d.Date : null;
    }

    private async Task<string?> ValidateCodeNameUniqueAsync(string? code, string? name, int? excludeProcedureId)
    {
        var all = await _ds.ListWorkProceduresAsync();
        var codeT = (code ?? "").Trim();
        var nameT = (name ?? "").Trim();
        foreach (var x in all)
        {
            if (excludeProcedureId.HasValue && x.Id == excludeProcedureId.Value) continue;
            if (string.Equals((x.Code ?? "").Trim(), codeT, StringComparison.OrdinalIgnoreCase))
                return "ترميز الإجراء مستخدم مسبقاً — لا يُسمح بالتكرار";
            if (string.Equals((x.Name ?? "").Trim(), nameT, StringComparison.OrdinalIgnoreCase))
                return "اسم الإجراء مستخدم مسبقاً — لا يُسمح بالتكرار";
        }
        return null;
    }

    /// <summary>تحقق من تفرّد الترميز/الاسم عند التعديل مع تجاهل أعضاء سلسلة الإصدارات لنفس الإجراء.</summary>
    private async Task<string?> ValidateCodeNameUniqueIgnoringVersionFamilyAsync(string? code, string? name, WorkProcedure current)
    {
        var all = await _ds.ListWorkProceduresAsync();
        var codeT = (code ?? "").Trim();
        var nameT = (name ?? "").Trim();
        var rootId = current.VersionRootProcedureId > 0 ? current.VersionRootProcedureId : current.Id;
        foreach (var x in all)
        {
            if (x.Id == current.Id) continue;
            var xRoot = x.VersionRootProcedureId > 0 ? x.VersionRootProcedureId : x.Id;
            if (xRoot == rootId) continue;
            if (string.Equals((x.Code ?? "").Trim(), codeT, StringComparison.OrdinalIgnoreCase))
                return "ترميز الإجراء مستخدم مسبقاً — لا يُسمح بالتكرار";
            if (string.Equals((x.Name ?? "").Trim(), nameT, StringComparison.OrdinalIgnoreCase))
                return "اسم الإجراء مستخدم مسبقاً — لا يُسمح بالتكرار";
        }
        return null;
    }

    private string? ValidateWorkProcedureRequest(WorkProcedureRequest req, bool isCreate)
    {
        if (string.IsNullOrWhiteSpace(req.Code)) return "ترميز الإجراء مطلوب";
        if (string.IsNullOrWhiteSpace(req.Name)) return "اسم الإجراء مطلوب";
        if (req.ProcedureActionTypeId <= 0) return "نوع الإجراء مطلوب";
        if (req.FormTemplateId <= 0) return "القالب المستخدم مطلوب";
        if (string.IsNullOrWhiteSpace(req.UsageFrequency)) return "معدل الاستخدام مطلوب";
        if (string.IsNullOrWhiteSpace(req.ProcedureClassification)) return "التصنيف مطلوب";
        if (string.IsNullOrWhiteSpace(req.ConfidentialityLevel)) return "مستوى السرية مطلوب";
        if (string.IsNullOrWhiteSpace(req.ValidityType)) return "صلاحية الإجراء مطلوبة";
        if (req.OrganizationalUnitId <= 0) return "الوحدة التنظيمية المالكة للإجراء مطلوبة";
        if (req.TargetOrganizationalUnitIds == null || req.TargetOrganizationalUnitIds.Count == 0)
            return "الوحدات التنظيمية المستهدفة مطلوبة";
        if (req.ExecutorBeneficiaryIds == null || req.ExecutorBeneficiaryIds.Count == 0)
            return "المنفذين للإجراء مطلوبون";
        if (req.ValidityType == "مؤقت")
        {
            if (string.IsNullOrWhiteSpace(req.ValidityStartDate)) return "تاريخ بداية الصلاحية مطلوب";
            if (string.IsNullOrWhiteSpace(req.ValidityEndDate)) return "تاريخ نهاية الصلاحية مطلوب";
            if (!DateTime.TryParse(req.ValidityStartDate, out var st))
                return "تاريخ بداية الصلاحية غير صالح";
            if (!DateTime.TryParse(req.ValidityEndDate, out var e))
                return "تاريخ نهاية الصلاحية غير صالح";
            if (st.Date < DateTime.Today)
                return "تاريخ البداية لا يمكن أن يكون قبل تاريخ اليوم";
            if (e < st)
                return "تاريخ النهاية يجب أن يكون بعد تاريخ البداية أو مساوياً له";
        }
        return null;
    }

    private static string SerializeUsedForms(List<UsedFormDefItem>? items)
    {
        if (items == null || items.Count == 0) return "[]";
        var clean = items
            .Where(x => x.FormDefinitionId > 0)
            .Select(x => new { formDefinitionId = x.FormDefinitionId, visibility = string.IsNullOrWhiteSpace(x.Visibility) ? "عام" : x.Visibility })
            .ToList();
        return JsonSerializer.Serialize(clean, JsonOpts);
    }

    private static bool ProcedureUsesFormDefinition(WorkProcedure p, int formDefinitionId)
    {
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(p.UsedFormDefinitionsJson) ? "[]" : p.UsedFormDefinitionsJson);
            foreach (var el in doc.RootElement.EnumerateArray())
            {
                if (el.TryGetProperty("formDefinitionId", out var fd) && fd.ValueKind == JsonValueKind.Number && fd.GetInt32() == formDefinitionId)
                    return true;
            }
        }
        catch { /* ignore */ }
        return false;
    }

    private static bool ProcedureTargetsOrganizationalUnit(WorkProcedure p, int orgUnitId)
    {
        try
        {
            var ids = JsonSerializer.Deserialize<List<int>>(p.TargetOrganizationalUnitIdsJson ?? "[]", JsonOpts);
            return ids != null && ids.Contains(orgUnitId);
        }
        catch { return false; }
    }

    private static bool ProcedureHasExecutorBeneficiary(WorkProcedure p, int beneficiaryId)
    {
        try
        {
            var ids = JsonSerializer.Deserialize<List<int>>(p.ExecutorBeneficiaryIdsJson ?? "[]", JsonOpts);
            return ids != null && ids.Contains(beneficiaryId);
        }
        catch { return false; }
    }

    private static bool ProcedureHasAnyExecutorBeneficiaryInSet(WorkProcedure p, HashSet<int> beneficiaryIds)
    {
        if (beneficiaryIds.Count == 0) return false;
        try
        {
            var ids = JsonSerializer.Deserialize<List<int>>(p.ExecutorBeneficiaryIdsJson ?? "[]", JsonOpts);
            return ids != null && ids.Any(beneficiaryIds.Contains);
        }
        catch { return false; }
    }

    private static bool IsProcedureCurrentlyActive(WorkProcedure p)
    {
        if (!p.IsActive || p.Status != "approved") return false;
        if (p.ValidityType == "مؤقت" && p.ValidityEndDate.HasValue && p.ValidityEndDate.Value.Date < DateTime.Today)
            return false;
        return true;
    }

    private static bool IsExecutorRoleFullySelectedForProcedure(ExecutorRole role, HashSet<int> procBenIds)
    {
        var bids = ParseCsvIntIds(role.ExecutorIds);
        return bids.Count > 0 && bids.All(procBenIds.Contains);
    }

    private static string? ValidateWorkflowStepsForPublish(string? workflowStepsJson)
    {
        try
        {
            var steps = JsonSerializer.Deserialize<List<WorkflowStepSaveDto>>(workflowStepsJson ?? "[]", WorkflowJsonOpts) ?? new();
            if (!steps.Any())
                return "يجب إضافة خطوة واحدة على الأقل في سير العمل قبل النشر";
        }
        catch
        {
            return "سير العمل غير صالح";
        }
        return null;
    }

    private async Task<string?> ValidateTargetBeneficiaryIdsAsync(List<int>? ids, List<int> targetOrgUnitIds)
    {
        if (ids == null || ids.Count == 0) return null;
        var targetSet = targetOrgUnitIds.Where(x => x > 0).ToHashSet();
        if (targetSet.Count == 0)
            return "يجب اختيار الوحدات التنظيمية المستهدفة قبل تحديد المستهدفين المعنيين";
        var beneficiaries = await _ds.ListBeneficiariesAsync();
        foreach (var bid in ids.Distinct())
        {
            var b = beneficiaries.FirstOrDefault(x => x.Id == bid);
            if (b == null || !b.IsActive)
                return "أحد المستهدفين المعنيين غير صالح أو غير مفعّل";
            if (!b.OrganizationalUnitId.HasValue || !targetSet.Contains(b.OrganizationalUnitId.Value))
                return "المستهدفون المعنيون يجب أن ينتموا إلى الوحدات التنظيمية المستهدفة المختارة";
        }
        return null;
    }

    private async Task ApplyDerivedWorkspaceIdAsync(WorkProcedureRequest req)
    {
        if (req.WorkspaceId > 0) return;
        if (req.UsedForms == null || req.UsedForms.Count == 0) return;
        var fdAll = await _ds.ListFormDefinitionsAsync();
        foreach (var it in req.UsedForms)
        {
            var fd = fdAll.FirstOrDefault(f => f.Id == it.FormDefinitionId);
            if (fd != null && fd.WorkspaceId > 0)
            {
                req.WorkspaceId = fd.WorkspaceId;
                return;
            }
        }
    }

    private async Task<bool> CanAssignWorkspaceAsync(int workspaceId, bool isAdmin, int myOrgUnitId, List<OrganizationalUnit> unitsAll)
    {
        var ws = await _ds.GetWorkspaceByIdAsync(workspaceId);
        if (ws == null || !ws.IsActive) return false;
        if (isAdmin) return true;
        var allowed = DescendantOrgUnitIdsIncludingSelf(myOrgUnitId, unitsAll);
        return allowed.Contains(ws.OrganizationalUnitId);
    }

    private async Task<List<Workspace>> ListWorkspacesForUserAsync(bool isAdmin, int myOrgUnitId, List<OrganizationalUnit> unitsAll)
    {
        var all = await _ds.ListActiveWorkspacesAsync();
        if (isAdmin) return all.OrderBy(w => w.SortOrder).ToList();
        var allowed = DescendantOrgUnitIdsIncludingSelf(myOrgUnitId, unitsAll);
        return all.Where(w => allowed.Contains(w.OrganizationalUnitId)).OrderBy(w => w.SortOrder).ToList();
    }

    private async Task<List<FormDefinition>> ListFormDefinitionsForUserAsync(bool isAdmin, int myOrgUnitId, bool activeApprovedOnly = false)
    {
        var all = await _ds.ListFormDefinitionsAsync();
        IEnumerable<FormDefinition> q = isAdmin
            ? FormDefinitionVisibility.FilterForAdmin(all, CurrentUserFullName)
            : FormDefinitionVisibility.FilterForEmployee(all, myOrgUnitId);
        if (activeApprovedOnly)
            q = q.Where(FormDefinitionIsActiveApproved);
        return q.OrderByDescending(f => f.CreatedAt).ToList();
    }

    private async Task<List<ExecutorRole>> ListExecutorRolesForUserAsync(bool isAdmin, HashSet<int> allowedOrgIds)
    {
        var all = await _ds.ListExecutorRolesAsync();
        var active = all.Where(r => r.IsActive).ToList();
        if (isAdmin) return active.OrderBy(r => r.SortOrder).ToList();
        return active.Where(r => RoleTouchesOrgUnits(r, allowedOrgIds)).OrderBy(r => r.SortOrder).ToList();
    }

    private async Task<List<ExecutorRole>> ListExecutorRolesForProcedureExecutorsPicklistAsync(bool isAdmin, HashSet<int> allowedOrgIds)
    {
        if (isAdmin)
            return await ListExecutorRolesForUserAsync(true, allowedOrgIds);
        var all = await _ds.ListExecutorRolesAsync();
        return all.Where(r => r.IsActive).OrderBy(r => r.SortOrder).ToList();
    }

    private static bool RoleTouchesOrgUnits(ExecutorRole r, HashSet<int> allowedOrgIds)
    {
        if (string.IsNullOrWhiteSpace(r.OrgUnitIds)) return true;
        foreach (var part in r.OrgUnitIds.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (int.TryParse(part, out var id) && allowedOrgIds.Contains(id))
                return true;
        }
        return false;
    }

    private static bool ValidateTargetOrganizationalUnitsActive(List<int> targets, List<OrganizationalUnit> unitsAll)
    {
        var activeIds = DataService.FilterEffectivelyActiveOrganizationalUnits(unitsAll).Select(u => u.Id).ToHashSet();
        foreach (var t in targets)
        {
            if (t <= 0 || !activeIds.Contains(t)) return false;
        }
        return true;
    }

    private static HashSet<int> DescendantOrgUnitIdsIncludingSelf(int rootId, List<OrganizationalUnit> all)
    {
        var set = new HashSet<int> { rootId };
        var changed = true;
        while (changed)
        {
            changed = false;
            foreach (var u in all)
            {
                if (u.ParentId.HasValue && set.Contains(u.ParentId.Value) && set.Add(u.Id))
                    changed = true;
            }
        }
        return set;
    }

    private async Task<int> GetCreatorOrgUnitIdAsync()
    {
        var units = await _ds.ListOrganizationalUnitsAsync();
        var unit = units.FirstOrDefault(u => u.Id == CurrentDeptId);
        return unit?.Id ?? CurrentDeptId;
    }

    // ─── DTOs ──────────────────────────────────────────────────────────────────

    public class UsedFormDefItem
    {
        public int FormDefinitionId { get; set; }
        public string? Visibility { get; set; }
    }

    public class WorkProcedureRequest
    {
        public string Code { get; set; } = "";
        public string Name { get; set; } = "";
        public string? Objectives { get; set; }
        public string? RegulationsAttachmentsJson { get; set; }
        public int ProcedureActionTypeId { get; set; }
        public int FormTemplateId { get; set; }
        public int WorkspaceId { get; set; }
        public List<UsedFormDefItem>? UsedForms { get; set; }
        public List<int>? ExecutorBeneficiaryIds { get; set; }
        public string? UsageFrequency { get; set; }
        public string? ProcedureClassification { get; set; }
        public string? ConfidentialityLevel { get; set; }
        public string? ValidityType { get; set; }
        public string? ValidityStartDate { get; set; }
        public string? ValidityEndDate { get; set; }
        public int OrganizationalUnitId { get; set; }
        public List<int>? TargetOrganizationalUnitIds { get; set; }
        public List<int>? TargetBeneficiaryIds { get; set; }
        public List<int>? PreviousProcedureIds { get; set; }
        public List<int>? NextProcedureIds { get; set; }
        public List<int>? ImplicitProcedureIds { get; set; }
        public string? AdditionalInputs { get; set; }
        public string? AdditionalOutputs { get; set; }
        /// <summary>عند الإنشاء من «إصدار جديد»: معرّف الإجراء المُستمد منه.</summary>
        public int? BaseProcedureId { get; set; }
        public bool SendForApproval { get; set; }
    }

    public class WorkProcedureUpdateRequest : WorkProcedureRequest
    {
        public int Id { get; set; }
    }

    public class WorkProcedureIdRequest
    {
        public int Id { get; set; }
    }

    public class WorkProcedureRejectRequest
    {
        public int Id { get; set; }
        public string? Reason { get; set; }
    }

    public class OrgUnitsBeneficiariesRequest
    {
        public List<int>? OrganizationalUnitIds { get; set; }
    }

    public class WorkflowStepSaveDto
    {
        public int Id { get; set; }
        public int SortOrder { get; set; }
        public bool IsDecision { get; set; }
        public string StepLabel { get; set; } = "";
        public int ExecutorRoleId { get; set; }
        public string ExpectedDurationDays { get; set; } = "";
        public string ExpectedDurationHours { get; set; } = "";
        public bool IsConcurrentStep { get; set; }
        public List<bool>? EscalationSyncFlags { get; set; }
        public int? ReturnStepId { get; set; }
        public int? ProgressStepId { get; set; }
        public int? FormDefinitionId { get; set; }
        /// <summary>قسم النموذج المرتبط بالخطوة (اختيار مفرد) عند وجود أقسام في النموذج.</summary>
        public int? FormSectionId { get; set; }
        public int? FormStatusId { get; set; }
        public string NotificationChannel { get; set; } = "in_app";
        public string OverdueNotificationText { get; set; } = "";
        public string ExecutionNotificationText { get; set; } = "";
        public string? Notes { get; set; }

        /// <summary>"specific" (دور من «أدوار المنفذين») أو "fixed" (نوع ثابت كالموظف/المدير...).</summary>
        public string AssigneeMode { get; set; } = "specific";
        /// <summary>عند AssigneeMode = "fixed": employee | direct_manager | managers_chain | unit_manager | unit_representative | system_admin</summary>
        public string AssigneeFixedType { get; set; } = "";
        /// <summary>الوحدة التنظيمية المصاحبة عند fixed-type = unit_manager / unit_representative.</summary>
        public int? AssigneeOrgUnitId { get; set; }
        /// <summary>الإجراءات المسموحة للخطوة: approve|reject|return|concurrent_approvals|reassign|request_clarification</summary>
        public List<string>? AllowedActions { get; set; }
        /// <summary>خطوة التزامن — تظهر فقط إذا AllowedActions تحتوي concurrent_approvals.</summary>
        public int? ConcurrentStepId { get; set; }
        /// <summary>قنوات الإشعار المختارة (in_app|email|sms). تأخذ الأولوية على NotificationChannel المفرد.</summary>
        public List<string>? NotificationChannels { get; set; }
    }

    public class SaveWorkflowStepsRequest
    {
        public int WorkProcedureId { get; set; }
        public List<WorkflowStepSaveDto>? Steps { get; set; }
    }
}
