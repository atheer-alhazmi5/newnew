using System.Text.Json;
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
        int? workspaceId,
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

        if (!isAdmin)
        {
            all = all.Where(p => allowedOrgIds.Contains(p.OrganizationalUnitId)).ToList();
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            all = all.Where(p => (p.Name ?? "").ToLower().Contains(s)).ToList();
        }
        if (workspaceId.HasValue && workspaceId.Value > 0)
            all = all.Where(p => p.WorkspaceId == workspaceId.Value).ToList();
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
            all = all.Where(p => p.IsActive == want).ToList();
        }

        var workspacesAll = await _ds.ListWorkspacesAsync();
        var fdAll = await _ds.ListFormDefinitionsAsync();

        var data = all.Select(p => new
        {
            p.Id,
            p.Code,
            p.Name,
            WorkspaceName = workspacesAll.FirstOrDefault(w => w.Id == p.WorkspaceId)?.Name ?? "",
            ProcedureClassification = p.ProcedureClassification,
            OrgUnitName = unitsAll.FirstOrDefault(u => u.Id == p.OrganizationalUnitId)?.Name ?? "",
            ValidityType = p.ValidityType,
            p.Status,
            p.IsActive,
            p.CreatedBy,
            p.ApprovedBy,
            CreatedAt = p.CreatedAt.ToString("yyyy-MM-dd"),
            ApprovedAt = p.ApprovedAt?.ToString("yyyy-MM-dd"),
            p.RejectionReason
        }).ToList();

        var workspacesForFilter = await ListWorkspacesForUserAsync(isAdmin, myOrgUnitId, unitsAll);
        var formDefsForFilter = await ListFormDefinitionsForUserAsync(isAdmin, myOrgUnitId, activeApprovedOnly: true);
        var orgUnitsForFilter = unitsAll.Where(u => u.IsActive && (isAdmin || allowedOrgIds.Contains(u.Id)))
            .OrderBy(u => u.SortOrder)
            .ToList();
        var execRoles = await ListExecutorRolesForUserAsync(isAdmin, allowedOrgIds);
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
            workspaces = workspacesForFilter.Select(w => new { w.Id, w.Name }).ToList(),
            formDefinitions = formDefsForFilter.Select(f => new { f.Id, f.Name, f.WorkspaceId }).ToList(),
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

        var workspaces = (await ListWorkspacesForUserAsync(isAdmin, myOrgUnitId, unitsAll))
            .Select(w => new { w.Id, w.Name }).ToList();
        var formDefs = (await ListFormDefinitionsForUserAsync(isAdmin, myOrgUnitId, activeApprovedOnly: true))
            .Select(f => new { f.Id, f.Name, f.Ownership, f.OrganizationalUnitId, f.WorkspaceId }).ToList();
        var execRoles = await ListExecutorRolesForUserAsync(isAdmin, allowedOrgIds);
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
        var orgUnits = unitsAll.Where(u => u.IsActive && (isAdmin || allowedOrgIds.Contains(u.Id)))
            .OrderBy(u => u.SortOrder)
            .Select(u => new { u.Id, u.Name, u.ParentId, u.Level }).ToList();

        var myUnit = unitsAll.FirstOrDefault(u => u.Id == myOrgUnitId);
        var myOrgUnitName = myUnit?.Name ?? "";

        return Json(new { success = true, workspaces, formDefinitions = formDefs, executorBeneficiaries, executorRoles, organizationalUnits = orgUnits, isAdmin, myOrgUnitId, myOrgUnitName });
    }

    [HttpGet]
    public async Task<IActionResult> GetWorkProcedure(int id)
    {
        if (!IsAuthenticated) return Json(new { success = false });
        var p = await _ds.GetWorkProcedureByIdAsync(id);
        if (p == null) return Json(new { success = false, message = "غير موجود" });

        var isAdmin = CurrentUserRole == "Admin";
        var unitsAll = await _ds.ListOrganizationalUnitsAsync();
        var myOrgUnitId = await GetCreatorOrgUnitIdAsync();
        var allowedOrgIds = DescendantOrgUnitIdsIncludingSelf(myOrgUnitId, unitsAll);
        if (!isAdmin && !allowedOrgIds.Contains(p.OrganizationalUnitId))
            return Json(new { success = false, message = "غير مصرح" });

        var workspacesAll = await _ds.ListWorkspacesAsync();
        var wsList = await ListWorkspacesForUserAsync(isAdmin, myOrgUnitId, unitsAll);
        var wsForSelect = wsList.Select(w => new { id = w.Id, name = w.Name }).ToList();
        var curWs = workspacesAll.FirstOrDefault(w => w.Id == p.WorkspaceId);
        if (curWs != null && wsForSelect.All(x => x.id != curWs.Id))
            wsForSelect.Insert(0, new { id = curWs.Id, name = curWs.Name + (curWs.IsActive ? "" : " (غير مفعّل)") });

        var usedFormPickerExtras = await BuildUsedFormPickerExtrasAsync(p, isAdmin, myOrgUnitId);

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
                p.WorkspaceId,
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
                p.PreviousProcedureIdsJson,
                p.NextProcedureIdsJson,
                p.ImplicitProcedureIdsJson,
                p.AdditionalInputs,
                p.AdditionalOutputs,
                p.Status,
                p.RejectionReason,
                p.IsActive,
                p.CreatedBy,
                p.ApprovedBy,
                CreatedAt = p.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
                ApprovedAt = p.ApprovedAt?.ToString("yyyy-MM-dd HH:mm"),
                WorkspaceName = workspacesAll.FirstOrDefault(w => w.Id == p.WorkspaceId)?.Name ?? "",
                OrgUnitName = unitsAll.FirstOrDefault(u => u.Id == p.OrganizationalUnitId)?.Name ?? "",
                WorkflowStepsJson = p.WorkflowStepsJson ?? "[]"
            },
            workspaces = wsForSelect,
            usedFormPickerExtras
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
        if (!isAdmin && !allowedOrgIds.Contains(p.OrganizationalUnitId))
            return Json(new { success = false, message = "غير مصرح" });

        var procBenIds = ParseProcedureBeneficiaryIds(p);
        var allRoles = await _ds.ListExecutorRolesAsync();
        var beneficiariesAll = await _ds.ListBeneficiariesAsync();
        var allowedExecutorRoles = allRoles
            .Where(r => r.IsActive && ParseCsvIntIds(r.ExecutorIds).Any(id => procBenIds.Contains(id)))
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
            .Select(f => new { id = f.Id, name = f.Name })
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
            procBeneficiaries
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
        if (!isAdmin && !allowedOrgIds.Contains(p.OrganizationalUnitId))
            return Json(new { success = false, message = "غير مصرح" });

        var beneficiariesAll = await _ds.ListBeneficiariesAsync();
        var err = ValidateWorkflowStepsPayload(p, req.Steps ?? new(), beneficiariesAll, await _ds.ListExecutorRolesAsync(), await _ds.ListFormDefinitionsAsync(), await _ds.ListFormStatusesAsync());
        if (err != null) return Json(new { success = false, message = err });

        var normalized = NormalizeWorkflowStepsForSave(p, req.Steps ?? new(), beneficiariesAll, await _ds.ListExecutorRolesAsync());
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

    private string? ValidateWorkflowStepsPayload(
        WorkProcedure p,
        List<WorkflowStepSaveDto> steps,
        List<Beneficiary> beneficiariesAll,
        List<ExecutorRole> allRoles,
        List<FormDefinition> fdAll,
        List<FormStatus> fsAll)
    {
        var procBenIds = ParseProcedureBeneficiaryIds(p);
        var allowedRoleIds = allRoles
            .Where(r => r.IsActive && ParseCsvIntIds(r.ExecutorIds).Any(id => procBenIds.Contains(id)))
            .Select(r => r.Id)
            .ToHashSet();
        var usedFdIds = ParseUsedFormDefinitionIds(p).ToHashSet();
        var fsIds = fsAll.Where(s => s.IsActive).Select(s => s.Id).ToHashSet();
        var ids = steps.Select(s => s.Id).ToList();
        if (ids.Any(x => x <= 0)) return "معرّف كل خطوة يجب أن يكون أكبر من صفر";
        if (ids.Count != ids.Distinct().Count()) return "معرّفات الخطوات يجب أن تكون فريدة";

        var idSet = ids.ToHashSet();
        foreach (var st in steps)
        {
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
                if (st.ExecutorRoleId <= 0 || !allowedRoleIds.Contains(st.ExecutorRoleId))
                    return "المنفذ غير مسموح لهذا الإجراء";
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

            if (!st.IsDecision)
            {
                if (st.FormDefinitionId.HasValue && st.FormDefinitionId.Value > 0 && !usedFdIds.Contains(st.FormDefinitionId.Value))
                    return "النموذج المختار غير ضمن النماذج المستخدمة للإجراء";
                if (st.FormStatusId.HasValue && st.FormStatusId.Value > 0 && !fsIds.Contains(st.FormStatusId.Value))
                    return "الحالة غير صالحة";
            }

            if (!string.IsNullOrWhiteSpace(st.NotificationChannel))
            {
                var ch = st.NotificationChannel.Trim().ToLowerInvariant();
                if (ch is not ("in_app" or "email" or "sms"))
                    return "قناة الإشعار غير صالحة";
            }
        }

        return null;
    }

    private static List<WorkflowStepSaveDto> NormalizeWorkflowStepsForSave(
        WorkProcedure p,
        List<WorkflowStepSaveDto> steps,
        List<Beneficiary> beneficiariesAll,
        List<ExecutorRole> allRoles)
    {
        var procBenIds = ParseProcedureBeneficiaryIds(p);
        var ordered = steps.OrderBy(s => s.SortOrder).ToList();
        var result = new List<WorkflowStepSaveDto>();
        foreach (var st in ordered)
        {
            var copy = new WorkflowStepSaveDto
            {
                Id = st.Id,
                SortOrder = st.SortOrder,
                IsDecision = st.IsDecision,
                StepLabel = st.IsDecision ? "قرار" : (st.StepLabel ?? "").Trim(),
                ExecutorRoleId = st.ExecutorRoleId,
                ExpectedDurationDays = st.ExpectedDurationDays?.Trim() ?? "",
                ExpectedDurationHours = st.ExpectedDurationHours?.Trim() ?? "",
                IsConcurrentStep = st.IsConcurrentStep,
                EscalationSyncFlags = st.EscalationSyncFlags,
                ReturnStepId = st.ReturnStepId,
                ProgressStepId = st.ProgressStepId,
                FormDefinitionId = st.FormDefinitionId,
                FormStatusId = st.FormStatusId,
                NotificationChannel = string.IsNullOrWhiteSpace(st.NotificationChannel) ? "in_app" : st.NotificationChannel.Trim(),
                OverdueNotificationText = st.OverdueNotificationText?.Trim() ?? "",
                ExecutionNotificationText = st.ExecutionNotificationText?.Trim() ?? "",
                Notes = st.Notes?.Trim()
            };
            if (copy.IsDecision)
            {
                copy.ExpectedDurationDays = "";
                copy.ExpectedDurationHours = "";
                copy.IsConcurrentStep = false;
                copy.EscalationSyncFlags = null;
                copy.FormDefinitionId = null;
                copy.FormStatusId = null;
                copy.NotificationChannel = "in_app";
                copy.OverdueNotificationText = "";
                copy.ExecutionNotificationText = "";
            }
            else
            {
                var role = allRoles.FirstOrDefault(r => r.Id == copy.ExecutorRoleId);
                if (role == null || !IsExecutorRoleManagerLike(role, procBenIds, beneficiariesAll))
                {
                    copy.IsConcurrentStep = false;
                    copy.EscalationSyncFlags = null;
                }
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

        var uniqErrAdd = await ValidateCodeNameUniqueAsync(req.Code, req.Name, null);
        if (uniqErrAdd != null) return Json(new { success = false, message = uniqErrAdd });

        var isAdmin = CurrentUserRole == "Admin";
        var unitsAll = await _ds.ListOrganizationalUnitsAsync();
        var myOrgUnitId = await GetCreatorOrgUnitIdAsync();
        var allowedOrgIds = DescendantOrgUnitIdsIncludingSelf(myOrgUnitId, unitsAll);

        var usedErr = await ValidateUsedFormsAsync(req.UsedForms, isAdmin, myOrgUnitId, req.WorkspaceId, grandfatheredUsedFormDefIds: null);
        if (usedErr != null) return Json(new { success = false, message = usedErr });
        var execErr = await ValidateExecutorBeneficiaryIdsAsync(req.ExecutorBeneficiaryIds, isAdmin, allowedOrgIds);
        if (execErr != null) return Json(new { success = false, message = execErr });
        var relErr = await ValidateProcedureRelationsAsync(null, req.PreviousProcedureIds, req.NextProcedureIds, req.ImplicitProcedureIds, isAdmin, allowedOrgIds);
        if (relErr != null) return Json(new { success = false, message = relErr });

        if (!await CanAssignWorkspaceAsync(req.WorkspaceId, isAdmin, myOrgUnitId, unitsAll))
            return Json(new { success = false, message = "مساحة العمل غير مسموحة" });

        if (isAdmin)
        {
            var ou = unitsAll.FirstOrDefault(u => u.Id == req.OrganizationalUnitId);
            if (ou == null || !ou.IsActive)
                return Json(new { success = false, message = "الوحدة المالكة غير صالحة" });
        }
        else
            req.OrganizationalUnitId = myOrgUnitId;

        if (!ValidateTargetOrgUnits(req.TargetOrganizationalUnitIds ?? new List<int>(), allowedOrgIds, isAdmin))
            return Json(new { success = false, message = "إحدى الوحدات المستهدفة غير مسموحة" });

        var send = req.SendForApproval;
        var w = BuildEntityFromRequest(req, new WorkProcedure(), isAdmin, send);
        w.CreatedBy = CurrentUserFullName;

        var created = await _ds.AddWorkProcedureAsync(w);
        await _ds.AddAuditLogAsync(BuildAuditEntry("إضافة إجراء عمل", "WorkProcedure", created.Id.ToString(), req.Name));
        return Json(new { success = true, id = created.Id });
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

        var uniqErr = await ValidateCodeNameUniqueAsync(req.Code, req.Name, req.Id);
        if (uniqErr != null) return Json(new { success = false, message = uniqErr });

        var isAdmin = CurrentUserRole == "Admin";
        var unitsAll = await _ds.ListOrganizationalUnitsAsync();
        var myOrgUnitId = await GetCreatorOrgUnitIdAsync();
        var allowedOrgIds = DescendantOrgUnitIdsIncludingSelf(myOrgUnitId, unitsAll);

        var usedErr = await ValidateUsedFormsAsync(req.UsedForms, isAdmin, myOrgUnitId, req.WorkspaceId, ParseUsedFormDefinitionIds(p).ToHashSet());
        if (usedErr != null) return Json(new { success = false, message = usedErr });
        var execErr = await ValidateExecutorBeneficiaryIdsAsync(req.ExecutorBeneficiaryIds, isAdmin, allowedOrgIds);
        if (execErr != null) return Json(new { success = false, message = execErr });
        var relErr = await ValidateProcedureRelationsAsync(req.Id, req.PreviousProcedureIds, req.NextProcedureIds, req.ImplicitProcedureIds, isAdmin, allowedOrgIds);
        if (relErr != null) return Json(new { success = false, message = relErr });

        if (!isAdmin && !allowedOrgIds.Contains(p.OrganizationalUnitId))
            return Json(new { success = false, message = "غير مصرح" });

        if (!await CanAssignWorkspaceAsync(req.WorkspaceId, isAdmin, myOrgUnitId, unitsAll))
            return Json(new { success = false, message = "مساحة العمل غير مسموحة" });

        if (isAdmin)
        {
            var ou = unitsAll.FirstOrDefault(u => u.Id == req.OrganizationalUnitId);
            if (ou == null || !ou.IsActive)
                return Json(new { success = false, message = "الوحدة المالكة غير صالحة" });
        }
        else
            req.OrganizationalUnitId = p.OrganizationalUnitId;

        if (!ValidateTargetOrgUnits(req.TargetOrganizationalUnitIds ?? new List<int>(), allowedOrgIds, isAdmin))
            return Json(new { success = false, message = "إحدى الوحدات المستهدفة غير مسموحة" });

        BuildEntityFromRequest(req, p, isAdmin, req.SendForApproval);
        p.UpdatedBy = CurrentUserFullName;
        p.UpdatedAt = DateTime.Now;

        if (req.SendForApproval)
        {
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
        if (!isAdmin && !allowedOrgIds.Contains(p.OrganizationalUnitId))
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
        return Json(new { success = true, isActive = p.IsActive });
    }

    [HttpGet]
    public async Task<IActionResult> ListRelatedProcedures(int? excludeId)
    {
        if (!IsAuthenticated) return Json(new { success = false });
        var isAdmin = CurrentUserRole == "Admin";
        var unitsAll = await _ds.ListOrganizationalUnitsAsync();
        var myOrgUnitId = await GetCreatorOrgUnitIdAsync();
        var allowedOrgIds = DescendantOrgUnitIdsIncludingSelf(myOrgUnitId, unitsAll);

        var all = await _ds.ListWorkProceduresAsync();
        if (!isAdmin)
            all = all.Where(p => allowedOrgIds.Contains(p.OrganizationalUnitId)).ToList();
        if (excludeId.HasValue && excludeId.Value > 0)
            all = all.Where(p => p.Id != excludeId.Value).ToList();

        return Json(new
        {
            success = true,
            data = all.OrderByDescending(p => p.CreatedAt).Select(p => new { p.Id, p.Code, p.Name }).ToList()
        });
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    private async Task ApplyAutoCloseExpiredAsync()
    {
        var list = await _ds.ListWorkProceduresAsync();
        var today = DateTime.Today;
        foreach (var p in list)
        {
            if (p.Status == "approved" && p.ValidityType == "مؤقت" && p.ValidityEndDate.HasValue
                && p.ValidityEndDate.Value.Date < today && p.IsActive)
            {
                p.IsActive = false;
                p.UpdatedAt = DateTime.Now;
                await _ds.UpdateWorkProcedureAsync(p);
            }
        }
    }

    private async Task<string?> ValidateUsedFormsAsync(List<UsedFormDefItem>? items, bool isAdmin, int myOrgUnitId, int workspaceId, HashSet<int>? grandfatheredUsedFormDefIds)
    {
        if (items == null || items.Count == 0) return "النماذج المستخدمة مطلوبة";
        if (workspaceId <= 0) return "مساحة العمل مطلوبة";
        var allowed = await ListFormDefinitionsForUserAsync(isAdmin, myOrgUnitId, activeApprovedOnly: false);
        var byId = allowed.ToDictionary(f => f.Id);
        foreach (var it in items)
        {
            if (it.FormDefinitionId <= 0) return "نموذج غير صالح";
            if (!byId.TryGetValue(it.FormDefinitionId, out var fd)) return "أحد النماذج المختارة غير مسموح به";
            if (fd.WorkspaceId != workspaceId) return "يجب أن تكون النماذج المستخدمة ضمن مساحة العمل المختارة";
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
        var activeInWs = activeInPicker.Where(f => f.WorkspaceId == p.WorkspaceId).Select(f => f.Id).ToHashSet();
        var fdAll = await _ds.ListFormDefinitionsAsync();
        var byId = fdAll.ToDictionary(f => f.Id);

        var list = new List<object>();
        foreach (var id in usedIds)
        {
            if (activeInWs.Contains(id)) continue;
            if (!byId.TryGetValue(id, out var f))
            {
                list.Add(new { id, name = $"نموذج #{id}", workspaceId = 0 });
                continue;
            }
            var suffix = FormDefinitionIsActiveApproved(f) ? "" : " (غير مفعّل أو غير معتمد)";
            list.Add(new { id, name = f.Name + suffix, workspaceId = f.WorkspaceId });
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
        var roles = await ListExecutorRolesForUserAsync(isAdmin, allowedOrgIds);
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
            if (!isAdmin && !allowedOrgIds.Contains(o.OrganizationalUnitId))
                return "إجراء مرتبط غير مسموح به";
        }
        return null;
    }

    private WorkProcedure BuildEntityFromRequest(WorkProcedureRequest req, WorkProcedure w, bool isAdmin, bool sendForApproval)
    {
        w.Code = req.Code.Trim();
        w.Name = req.Name.Trim();
        w.Objectives = req.Objectives?.Trim() ?? "";
        w.RegulationsAttachmentsJson = string.IsNullOrWhiteSpace(req.RegulationsAttachmentsJson) ? "[]" : req.RegulationsAttachmentsJson!;
        w.WorkspaceId = req.WorkspaceId;
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
        w.PreviousProcedureIdsJson = JsonSerializer.Serialize(req.PreviousProcedureIds ?? new List<int>(), JsonOpts);
        w.NextProcedureIdsJson = JsonSerializer.Serialize(req.NextProcedureIds ?? new List<int>(), JsonOpts);
        w.ImplicitProcedureIdsJson = JsonSerializer.Serialize(req.ImplicitProcedureIds ?? new List<int>(), JsonOpts);
        w.AdditionalInputs = req.AdditionalInputs?.Trim() ?? "";
        w.AdditionalOutputs = req.AdditionalOutputs?.Trim() ?? "";

        if (w.Id == 0)
        {
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

    private string? ValidateWorkProcedureRequest(WorkProcedureRequest req, bool isCreate)
    {
        if (string.IsNullOrWhiteSpace(req.Code)) return "ترميز الإجراء مطلوب";
        if (string.IsNullOrWhiteSpace(req.Name)) return "اسم الإجراء مطلوب";
        if (req.WorkspaceId <= 0) return "مساحة العمل مطلوبة";
        if (string.IsNullOrWhiteSpace(req.UsageFrequency)) return "معدل الاستخدام مطلوب";
        if (string.IsNullOrWhiteSpace(req.ProcedureClassification)) return "التصنيف مطلوب";
        if (string.IsNullOrWhiteSpace(req.ConfidentialityLevel)) return "مستوى السرية مطلوب";
        if (string.IsNullOrWhiteSpace(req.ValidityType)) return "صلاحية الإجراء مطلوبة";
        if (req.OrganizationalUnitId <= 0) return "الوحدة التنظيمية المالكة مطلوبة";
        if (req.TargetOrganizationalUnitIds == null || req.TargetOrganizationalUnitIds.Count == 0)
            return "الوحدات التنظيمية المستهدفة مطلوبة";
        if (req.ExecutorBeneficiaryIds == null || req.ExecutorBeneficiaryIds.Count == 0)
            return "المنفذين للإجراء مطلوبون";
        if (req.ValidityType == "مؤقت")
        {
            if (string.IsNullOrWhiteSpace(req.ValidityStartDate)) return "تاريخ بداية الصلاحية مطلوب";
            if (string.IsNullOrWhiteSpace(req.ValidityEndDate)) return "تاريخ نهاية الصلاحية مطلوب";
            if (DateTime.TryParse(req.ValidityEndDate, out var e) && DateTime.TryParse(req.ValidityStartDate, out var st) && e < st)
                return "تاريخ النهاية يجب أن يكون بعد تاريخ البداية";
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
        IEnumerable<FormDefinition> q = all;
        if (!isAdmin)
            q = q.Where(f =>
                f.Ownership == "عام" ||
                (f.Ownership == "خاص" && f.OrganizationalUnitId == myOrgUnitId));
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

    private static bool ValidateTargetOrgUnits(List<int> targets, HashSet<int> allowedOrgIds, bool isAdmin)
    {
        foreach (var t in targets)
        {
            if (t <= 0) return false;
            if (!isAdmin && !allowedOrgIds.Contains(t)) return false;
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
        public List<int>? PreviousProcedureIds { get; set; }
        public List<int>? NextProcedureIds { get; set; }
        public List<int>? ImplicitProcedureIds { get; set; }
        public string? AdditionalInputs { get; set; }
        public string? AdditionalOutputs { get; set; }
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
        public int? FormStatusId { get; set; }
        public string NotificationChannel { get; set; } = "in_app";
        public string OverdueNotificationText { get; set; } = "";
        public string ExecutionNotificationText { get; set; } = "";
        public string? Notes { get; set; }
    }

    public class SaveWorkflowStepsRequest
    {
        public int WorkProcedureId { get; set; }
        public List<WorkflowStepSaveDto>? Steps { get; set; }
    }
}
