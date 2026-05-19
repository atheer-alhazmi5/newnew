using System.Text.Json;
using FormsSystem.Models.Entities;
using FormsSystem.Services;
using Microsoft.AspNetCore.Mvc;

namespace FormsSystem.Controllers;

/// <summary>
/// صندوق الصادر — إدارة الطلبات المرتبطة بإجراءات العمل (WorkProcedure).
/// يدعم تقديم طلب جديد عبر معالج خطوات (Stepper)، حساب المرحلة الحالية وSLA،
/// وعرض/تحديث/حذف الطلبات.
/// </summary>
public class OutboxController : BaseController
{
    private readonly DataService _ds;
    private readonly UiHelperService _ui;

    private static readonly JsonSerializerOptions WorkflowJsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        WriteIndented = false
    };

    public OutboxController(DataService ds, UiHelperService ui) { _ds = ds; _ui = ui; }

    public IActionResult Index()
    {
        var auth = RequireAuth(); if (auth != null) return auth;
        SetViewBagUser(_ui);
        ViewBag.PageName = "صندوق الصادر";
        ViewBag.Title = "صندوق الصادر";
        return View();
    }

    public IActionResult Submit()
    {
        var auth = RequireAuth(); if (auth != null) return auth;
        SetViewBagUser(_ui);
        ViewBag.PageName = "تقديم طلب جديد";
        ViewBag.Title = "تقديم طلب جديد";
        return View();
    }

    // ─── LIST + LOOKUPS ───────────────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetRequests()
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });

        var requests = await _ds.ListOutboxRequestsAsync();
        var mine = requests.Where(r => r.SubmittedById == CurrentUserId).ToList();

        var procedures = await _ds.ListWorkProceduresAsync();
        var procTypes = await _ds.ListProcedureActionTypesAsync();
        var statuses = await _ds.ListFormStatusesAsync();

        var data = mine.Select(r =>
        {
            var proc = procedures.FirstOrDefault(p => p.Id == r.WorkProcedureId);
            var type = proc != null
                ? procTypes.FirstOrDefault(t => t.Id == proc.ProcedureActionTypeId)
                : null;
            var fs = r.CurrentFormStatusId.HasValue
                ? statuses.FirstOrDefault(s => s.Id == r.CurrentFormStatusId.Value)
                : null;

            // إعادة حساب SLA لحظياً لضمان دقة العرض
            var slaState = ComputeSlaState(r);

            return new
            {
                r.Id,
                r.RequestNumber,
                ProcedureId = r.WorkProcedureId,
                ProcedureName = proc?.Name ?? "",
                ProcedureCode = proc?.Code ?? "",
                ProcedureTypeId = type?.Id ?? 0,
                ProcedureTypeName = type?.Name ?? "",
                ProcedureTypeIcon = type?.Icon ?? "",
                ProcedureTypeColor = type?.Color ?? "#25935F",
                r.Priority,
                r.StatusCategory,
                CurrentStageName = fs?.Name ?? "",
                CurrentStageColor = fs?.Color ?? "#9DA4AE",
                SlaState = slaState,
                SubmittedAt = r.SubmittedAt.ToString("yyyy-MM-dd HH:mm"),
                ExpectedDueAt = r.ExpectedDueAt?.ToString("yyyy-MM-dd HH:mm"),
                ClosedAt = r.ClosedAt?.ToString("yyyy-MM-dd HH:mm"),
                r.IsEscalated
            };
        }).ToList();

        return Json(new
        {
            success = true,
            data,
            // فلاتر مرجعية
            procedures = procedures
                .Where(p => p.IsActive && p.Status == "approved")
                .OrderBy(p => p.Name)
                .Select(p => new { id = p.Id, name = p.Name }).ToList(),
            procedureTypes = procTypes
                .Where(t => t.IsActive)
                .OrderBy(t => t.SortOrder)
                .Select(t => new { id = t.Id, name = t.Name, icon = t.Icon, color = t.Color }).ToList(),
            stages = statuses
                .Where(s => s.IsActive)
                .OrderBy(s => s.SortOrder)
                .Select(s => new { id = s.Id, name = s.Name, color = s.Color, statusCategory = s.StatusCategory }).ToList()
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetRequest(int id)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        var r = await _ds.GetOutboxRequestByIdAsync(id);
        if (r == null) return Json(new { success = false, message = "غير موجود" });
        if (r.SubmittedById != CurrentUserId && CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var proc = await _ds.GetWorkProcedureByIdAsync(r.WorkProcedureId);
        var procTypes = await _ds.ListProcedureActionTypesAsync();
        var statuses = await _ds.ListFormStatusesAsync();
        var stagesForProc = ProcedureStages(proc, statuses).ToList();

        var type = proc != null
            ? procTypes.FirstOrDefault(t => t.Id == proc.ProcedureActionTypeId)
            : null;
        var fs = r.CurrentFormStatusId.HasValue
            ? statuses.FirstOrDefault(s => s.Id == r.CurrentFormStatusId.Value)
            : null;

        return Json(new
        {
            success = true,
            data = new
            {
                r.Id,
                r.RequestNumber,
                ProcedureId = r.WorkProcedureId,
                ProcedureName = proc?.Name ?? "",
                ProcedureCode = proc?.Code ?? "",
                ProcedureTypeId = type?.Id ?? 0,
                ProcedureTypeName = type?.Name ?? "",
                ProcedureTypeIcon = type?.Icon ?? "",
                ProcedureTypeColor = type?.Color ?? "#25935F",
                r.Priority,
                r.StatusCategory,
                CurrentStageId = r.CurrentFormStatusId,
                CurrentStageName = fs?.Name ?? "",
                CurrentStageColor = fs?.Color ?? "#9DA4AE",
                r.CurrentStepSortOrder,
                SlaState = ComputeSlaState(r),
                SubmittedAt = r.SubmittedAt.ToString("yyyy-MM-dd HH:mm"),
                ExpectedDueAt = r.ExpectedDueAt?.ToString("yyyy-MM-dd HH:mm"),
                ClosedAt = r.ClosedAt?.ToString("yyyy-MM-dd HH:mm"),
                r.FormDataJson,
                r.Notes,
                r.SubmittedByName,
                r.SubmittedByDept,
                r.IsEscalated
            },
            stages = stagesForProc
        });
    }

    // ─── PROCEDURES (cards in Step 1) ─────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetAvailableProcedures()
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        var procs = await _ds.ListWorkProceduresAsync();
        var procTypes = await _ds.ListProcedureActionTypesAsync();
        var workspaces = await _ds.ListWorkspacesAsync();

        var data = procs
            .Where(p => p.IsActive && p.Status == "approved")
            .OrderBy(p => p.Name)
            .Select(p =>
            {
                var t = procTypes.FirstOrDefault(x => x.Id == p.ProcedureActionTypeId);
                var ws = workspaces.FirstOrDefault(w => w.Id == p.WorkspaceId);
                return new
                {
                    p.Id,
                    p.Code,
                    p.Name,
                    p.Objectives,
                    TypeId = t?.Id ?? 0,
                    TypeName = t?.Name ?? "",
                    TypeIcon = t?.Icon ?? "",
                    TypeColor = t?.Color ?? "#25935F",
                    WorkspaceName = ws?.Name ?? "",
                    p.VersionLabel
                };
            })
            .ToList();

        return Json(new { success = true, data });
    }

    [HttpGet]
    public async Task<IActionResult> GetProcedureForSubmit(int id)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        var p = await _ds.GetWorkProcedureByIdAsync(id);
        if (p == null || !p.IsActive || p.Status != "approved")
            return Json(new { success = false, message = "الإجراء غير متاح" });

        var statuses = await _ds.ListFormStatusesAsync();
        var procTypes = await _ds.ListProcedureActionTypesAsync();
        var workspaces = await _ds.ListWorkspacesAsync();
        var t = procTypes.FirstOrDefault(x => x.Id == p.ProcedureActionTypeId);
        var ws = workspaces.FirstOrDefault(w => w.Id == p.WorkspaceId);
        var stages = ProcedureStages(p, statuses).ToList();

        var steps = ParseWorkflowSteps(p);
        var firstStep = steps.OrderBy(s => s.SortOrder).FirstOrDefault();
        int? firstStatusId = firstStep?.FormStatusId;

        return Json(new
        {
            success = true,
            data = new
            {
                p.Id,
                p.Code,
                p.Name,
                p.Objectives,
                TypeId = t?.Id ?? 0,
                TypeName = t?.Name ?? "",
                TypeIcon = t?.Icon ?? "",
                TypeColor = t?.Color ?? "#25935F",
                WorkspaceName = ws?.Name ?? "",
                p.VersionLabel,
                firstStepId = firstStep?.Id ?? 0,
                firstStepSortOrder = firstStep?.SortOrder ?? 1,
                firstStatusId
            },
            stages
        });
    }

    /// <summary>
    /// يُرجع النموذج (Form Definition) المرتبط بإجراء العمل (أول نموذج مفعّل ومعتمد من قائمته)،
    /// مع بيانات الوحدات المستهدفة والمنفذين لخطوة التأكيد.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetProcedureFormDefinition(int id)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        var p = await _ds.GetWorkProcedureByIdAsync(id);
        if (p == null || !p.IsActive || p.Status != "approved")
            return Json(new { success = false, message = "الإجراء غير متاح" });

        var usedFdIds = ParseIntArray(p.UsedFormDefinitionsJson);
        var fdAll = await _ds.ListFormDefinitionsAsync();
        var fd = fdAll.FirstOrDefault(f => usedFdIds.Contains(f.Id) && f.IsActive && string.Equals(f.Status, "approved", StringComparison.OrdinalIgnoreCase))
                 ?? fdAll.FirstOrDefault(f => usedFdIds.Contains(f.Id));

        // الوحدات التنظيمية المستهدفة والمنفذين (لرسالة التأكيد)
        var targetOrgIds = ParseIntArray(p.TargetOrganizationalUnitIdsJson);
        var unitsAll = await _ds.ListOrganizationalUnitsAsync();
        var targetOrgUnits = unitsAll
            .Where(u => targetOrgIds.Contains(u.Id))
            .OrderBy(u => u.SortOrder)
            .Select(u => new { id = u.Id, name = u.Name })
            .ToList();

        var executorBenIds = ParseIntArray(p.ExecutorBeneficiaryIdsJson);
        var bens = await _ds.ListBeneficiariesAsync();
        var executors = bens
            .Where(b => executorBenIds.Contains(b.Id))
            .Select(b => new { id = b.Id, fullName = b.FullName, role = b.RoleDisplayTable ?? "", unit = unitsAll.FirstOrDefault(u => u.Id == b.OrganizationalUnitId)?.Name ?? "" })
            .ToList();

        // أول معتمِد: منفذو الخطوة الأولى من سير العمل
        var steps = ParseWorkflowSteps(p);
        var firstStep = steps.OrderBy(s => s.SortOrder).FirstOrDefault();
        var firstApproverNames = new List<string>();
        if (firstStep != null)
        {
            // اسم تعريفي للخطوة (دور المنفذين) — يُعرض في رسالة التأكيد
            var execRolesAll = await _ds.ListExecutorRolesAsync();
            var role = execRolesAll.FirstOrDefault(r => r.Id == firstStep.ExecutorRoleId);
            if (role != null && !string.IsNullOrWhiteSpace(role.Name)) firstApproverNames.Add(role.Name);
        }

        if (fd == null)
        {
            return Json(new
            {
                success = true,
                hasForm = false,
                message = "لا يوجد نموذج مرتبط بهذا الإجراء",
                procedure = new
                {
                    p.Id, p.Name, p.Code
                },
                targetOrgUnits,
                executors,
                firstApprover = firstApproverNames.FirstOrDefault() ?? ""
            });
        }

        var templates = await _ds.ListFormTemplatesAsync();
        var tpl = templates.FirstOrDefault(x => x.Id == fd.TemplateId);

        // قالب — بنية مماثلة لـ GetFormDefinition.TemplateData لتفعيل عرض القالب المرتبط
        object? templateData = null;
        var hasSnapshot = !string.IsNullOrWhiteSpace(fd.TemplateHeaderJsonSnapshot) || !string.IsNullOrWhiteSpace(fd.TemplateFooterJsonSnapshot);
        if (hasSnapshot)
        {
            templateData = new
            {
                Id = fd.TemplateId,
                Name = !string.IsNullOrWhiteSpace(fd.TemplateNameSnapshot) ? fd.TemplateNameSnapshot : (tpl?.Name ?? ""),
                Color = !string.IsNullOrWhiteSpace(fd.TemplateColorSnapshot) ? fd.TemplateColorSnapshot : (tpl?.Color ?? "#14573A"),
                HeaderJson = string.IsNullOrWhiteSpace(fd.TemplateHeaderJsonSnapshot) ? "[]" : fd.TemplateHeaderJsonSnapshot,
                FooterJson = string.IsNullOrWhiteSpace(fd.TemplateFooterJsonSnapshot) ? "[]" : fd.TemplateFooterJsonSnapshot,
                MarginTop = fd.TemplateMarginTopSnapshot,
                MarginBottom = fd.TemplateMarginBottomSnapshot,
                MarginRight = fd.TemplateMarginRightSnapshot,
                MarginLeft = fd.TemplateMarginLeftSnapshot,
                PageDirection = string.IsNullOrWhiteSpace(fd.TemplatePageDirectionSnapshot) ? "RTL" : fd.TemplatePageDirectionSnapshot,
                ShowHeaderLine = fd.TemplateShowHeaderLineSnapshot,
                ShowFooterLine = fd.TemplateShowFooterLineSnapshot,
                WatermarkUrl = tpl?.WatermarkUrl ?? "",
                WatermarkOpacity = tpl?.WatermarkOpacity ?? 15
            };
        }
        else if (tpl != null)
        {
            templateData = new
            {
                tpl.Id, tpl.Name, tpl.Color,
                tpl.HeaderJson, tpl.FooterJson,
                tpl.MarginTop, tpl.MarginBottom, tpl.MarginRight, tpl.MarginLeft,
                tpl.PageDirection, tpl.ShowHeaderLine, tpl.ShowFooterLine,
                tpl.WatermarkUrl, tpl.WatermarkOpacity
            };
        }

        return Json(new
        {
            success = true,
            hasForm = true,
            procedure = new { p.Id, p.Name, p.Code },
            form = new
            {
                fd.Id, fd.Name, fd.Description, fd.FieldsJson, fd.TemplateId
            },
            templateData,
            targetOrgUnits,
            executors,
            firstApprover = firstApproverNames.FirstOrDefault() ?? ""
        });
    }

    /// <summary>
    /// يحلِّل JSON إلى قائمة معرّفات بشكل متسامح:
    /// - مصفوفة أرقام: [1,2,3]  (كما في ExecutorBeneficiaryIdsJson / TargetOrganizationalUnitIdsJson)
    /// - مصفوفة كائنات بحقل id/Id/formDefinitionId/FormDefinitionId  (كما في UsedFormDefinitionsJson)
    /// </summary>
    private static List<int> ParseIntArray(string? json)
    {
        var result = new List<int>();
        if (string.IsNullOrWhiteSpace(json)) return result;
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Array) return result;
            foreach (var el in doc.RootElement.EnumerateArray())
            {
                if (el.ValueKind == JsonValueKind.Number && el.TryGetInt32(out var n))
                {
                    result.Add(n);
                }
                else if (el.ValueKind == JsonValueKind.Object)
                {
                    foreach (var key in new[] { "formDefinitionId", "FormDefinitionId", "id", "Id" })
                    {
                        if (el.TryGetProperty(key, out var p) && p.ValueKind == JsonValueKind.Number && p.TryGetInt32(out var v))
                        {
                            result.Add(v);
                            break;
                        }
                    }
                }
                else if (el.ValueKind == JsonValueKind.String && int.TryParse(el.GetString(), out var sn))
                {
                    result.Add(sn);
                }
            }
        }
        catch { /* ignore — قائمة فارغة */ }
        return result;
    }

    // ─── CREATE / UPDATE / DELETE ─────────────────────────────────────────────
    public class OutboxSubmitDto
    {
        public int ProcedureId { get; set; }
        public string Priority { get; set; } = "متوسط";
        public string FormDataJson { get; set; } = "{}";
        public string Notes { get; set; } = "";
    }

    [HttpPost]
    public async Task<IActionResult> CreateRequest([FromBody] OutboxSubmitDto req)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        if (req == null || req.ProcedureId <= 0)
            return Json(new { success = false, message = "الإجراء مطلوب" });

        var proc = await _ds.GetWorkProcedureByIdAsync(req.ProcedureId);
        if (proc == null || !proc.IsActive || proc.Status != "approved")
            return Json(new { success = false, message = "الإجراء غير متاح" });

        var priority = NormalizePriority(req.Priority);

        var steps = ParseWorkflowSteps(proc);
        var first = steps.OrderBy(s => s.SortOrder).FirstOrDefault();
        var statuses = await _ds.ListFormStatusesAsync();
        var fs = first?.FormStatusId.HasValue == true
            ? statuses.FirstOrDefault(s => s.Id == first.FormStatusId!.Value)
            : null;

        var now = DateTime.Now;
        var due = ComputeDueAt(now, first);
        var requestNumber = await _ds.GenerateOutboxRequestNumberAsync(now);

        var entity = new OutboxRequest
        {
            RequestNumber = requestNumber,
            WorkProcedureId = proc.Id,
            CurrentStepSortOrder = first?.SortOrder ?? 1,
            CurrentStepId = first?.Id ?? 0,
            CurrentFormStatusId = first?.FormStatusId,
            Priority = priority,
            StatusCategory = (fs?.StatusCategory ?? "مفتوح").Trim(),
            ExpectedDueAt = due,
            SubmittedAt = now,
            FormDataJson = string.IsNullOrWhiteSpace(req.FormDataJson) ? "{}" : req.FormDataJson,
            Notes = (req.Notes ?? "").Trim(),
            SubmittedById = CurrentUserId,
            SubmittedByName = CurrentUserFullName,
            SubmittedByDept = CurrentDeptName
        };
        entity.SlaState = ComputeSlaState(entity);

        await _ds.AddOutboxRequestAsync(entity);

        // ─── Routing الفعلي: تحديد المستلمين + إنشاء assignments + إشعارات داخلية ───
        var procTypes = await _ds.ListProcedureActionTypesAsync();
        var procType = procTypes.FirstOrDefault(t => t.Id == proc.ProcedureActionTypeId);
        var recipients = await ResolveFirstStepRecipientsAsync(proc, first!);

        var deliveredTo = new List<object>();
        foreach (var rc in recipients)
        {
            var assignment = new Models.Entities.OutboxAssignment
            {
                OutboxRequestId = entity.Id,
                RequestNumber = entity.RequestNumber,
                WorkProcedureId = proc.Id,
                ProcedureName = proc.Name ?? "",
                ProcedureCode = proc.Code ?? "",
                ProcedureTypeName = procType?.Name ?? "",
                ProcedureTypeIcon = procType?.Icon ?? "",
                ProcedureTypeColor = procType?.Color ?? "#25935F",
                StepSortOrder = first?.SortOrder ?? 1,
                StepId = first?.Id ?? 0,
                StepLabel = first?.StepLabel ?? "",
                AssignedVia = rc.AssignedVia,
                RecipientUserId = rc.UserId,
                RecipientName = rc.FullName,
                RecipientUsername = rc.Username,
                RecipientDept = rc.Dept,
                SenderId = CurrentUserId,
                SenderName = CurrentUserFullName,
                SenderDept = CurrentDeptName,
                Status = "قيد الانتظار",
                AssignedAt = now
            };
            await _ds.AddOutboxAssignmentAsync(assignment);

            await _ds.CreateNotificationAsync(new Notification
            {
                RecipientId = rc.UserId,
                Type = "request_received",
                Title = $"طلب جديد: {entity.RequestNumber}",
                Message = $"تم توجيه طلب «{proc.Name}» إليك من {CurrentUserFullName}.",
                SenderName = CurrentUserFullName,
                SenderDepartment = CurrentDeptName
            });

            deliveredTo.Add(new { userId = rc.UserId, fullName = rc.FullName, assignedVia = rc.AssignedVia });
        }

        await _ds.AddAuditLogAsync(BuildAuditEntry("تقديم طلب", "OutboxRequest", entity.Id.ToString(),
            $"{entity.RequestNumber} — تم التسليم إلى {recipients.Count} مستلم"));

        return Json(new
        {
            success = true,
            id = entity.Id,
            requestNumber = entity.RequestNumber,
            message = "تم تقديم الطلب بنجاح",
            deliveredCount = recipients.Count,
            deliveredTo
        });
    }

    public class OutboxUpdateDto
    {
        public int Id { get; set; }
        public int? CurrentFormStatusId { get; set; }
        public string? Priority { get; set; }
        public string? FormDataJson { get; set; }
        public string? Notes { get; set; }
    }

    [HttpPost]
    public async Task<IActionResult> UpdateRequest([FromBody] OutboxUpdateDto req)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        if (req == null || req.Id <= 0)
            return Json(new { success = false, message = "معرّف الطلب مطلوب" });

        var r = await _ds.GetOutboxRequestByIdAsync(req.Id);
        if (r == null) return Json(new { success = false, message = "غير موجود" });
        if (r.SubmittedById != CurrentUserId && CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        if (string.Equals(r.StatusCategory, "مغلق", StringComparison.Ordinal))
            return Json(new { success = false, message = "لا يمكن تحديث طلب مغلق" });

        if (!string.IsNullOrWhiteSpace(req.Priority))
            r.Priority = NormalizePriority(req.Priority);

        if (req.FormDataJson != null) r.FormDataJson = req.FormDataJson;
        if (req.Notes != null) r.Notes = req.Notes.Trim();

        // تحديث المرحلة الحالية إن وُجدت
        if (req.CurrentFormStatusId.HasValue && req.CurrentFormStatusId.Value > 0)
        {
            var proc = await _ds.GetWorkProcedureByIdAsync(r.WorkProcedureId);
            var statuses = await _ds.ListFormStatusesAsync();
            var fs = statuses.FirstOrDefault(s => s.Id == req.CurrentFormStatusId.Value);
            if (fs == null) return Json(new { success = false, message = "الحالة غير صالحة" });

            r.CurrentFormStatusId = fs.Id;
            r.StatusCategory = (fs.StatusCategory ?? "مفتوح").Trim();

            // محاذاة CurrentStepSortOrder مع الخطوة المرتبطة بهذه الحالة
            var steps = ParseWorkflowSteps(proc);
            var match = steps.FirstOrDefault(s => s.FormStatusId == fs.Id);
            if (match != null)
            {
                r.CurrentStepSortOrder = match.SortOrder;
                r.CurrentStepId = match.Id;
                r.ExpectedDueAt = ComputeDueAt(r.SubmittedAt, match);
            }

            // إذا أصبح مغلق سجّل تاريخ الإغلاق
            if (string.Equals(r.StatusCategory, "مغلق", StringComparison.Ordinal) && r.ClosedAt == null)
                r.ClosedAt = DateTime.Now;
            else if (!string.Equals(r.StatusCategory, "مغلق", StringComparison.Ordinal))
                r.ClosedAt = null;
        }

        r.SlaState = ComputeSlaState(r);
        r.UpdatedBy = CurrentUserFullName;
        r.UpdatedAt = DateTime.Now;

        await _ds.UpdateOutboxRequestAsync(r);
        await _ds.AddAuditLogAsync(BuildAuditEntry("تحديث طلب", "OutboxRequest", r.Id.ToString(), r.RequestNumber));
        return Json(new { success = true, message = "تم تحديث الطلب" });
    }

    public class OutboxIdDto { public int Id { get; set; } }

    [HttpPost]
    public async Task<IActionResult> DeleteRequest([FromBody] OutboxIdDto req)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        if (req == null || req.Id <= 0) return Json(new { success = false, message = "غير موجود" });

        var r = await _ds.GetOutboxRequestByIdAsync(req.Id);
        if (r == null) return Json(new { success = false, message = "غير موجود" });
        if (r.SubmittedById != CurrentUserId && CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });
        if (string.Equals(r.StatusCategory, "مغلق", StringComparison.Ordinal))
            return Json(new { success = false, message = "لا يمكن حذف طلب مغلق" });

        await _ds.DeleteOutboxRequestAsync(req.Id);
        await _ds.AddAuditLogAsync(BuildAuditEntry("حذف طلب", "OutboxRequest", r.Id.ToString(), r.RequestNumber));
        return Json(new { success = true, message = "تم الحذف" });
    }

    // ─── PROCEDURE DETAILS (reuse work-procedures details panel) ─────────────
    [HttpGet]
    public async Task<IActionResult> GetProcedureDetails(int id)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        var p = await _ds.GetWorkProcedureByIdAsync(id);
        if (p == null) return Json(new { success = false, message = "غير موجود" });

        var procTypes = await _ds.ListProcedureActionTypesAsync();
        var workspaces = await _ds.ListWorkspacesAsync();
        var templates = await _ds.ListFormTemplatesAsync();
        var orgUnits = await _ds.ListOrganizationalUnitsAsync();
        var statuses = await _ds.ListFormStatusesAsync();

        var t = procTypes.FirstOrDefault(x => x.Id == p.ProcedureActionTypeId);
        var ws = workspaces.FirstOrDefault(w => w.Id == p.WorkspaceId);
        var tpl = templates.FirstOrDefault(x => x.Id == p.FormTemplateId);
        var ou = orgUnits.FirstOrDefault(u => u.Id == p.OrganizationalUnitId);
        var stages = ProcedureStages(p, statuses).ToList();

        return Json(new
        {
            success = true,
            data = new
            {
                p.Id,
                p.Code,
                p.Name,
                p.Objectives,
                TypeName = t?.Name ?? "",
                TypeIcon = t?.Icon ?? "",
                TypeColor = t?.Color ?? "#25935F",
                WorkspaceName = ws?.Name ?? "",
                FormTemplateName = tpl?.Name ?? "",
                OwnerOrgName = ou?.Name ?? "",
                p.UsageFrequency,
                p.ProcedureClassification,
                p.ConfidentialityLevel,
                p.ValidityType,
                ValidityStartDate = p.ValidityStartDate?.ToString("yyyy-MM-dd"),
                ValidityEndDate = p.ValidityEndDate?.ToString("yyyy-MM-dd"),
                p.AdditionalInputs,
                p.AdditionalOutputs,
                VersionLabel = string.IsNullOrWhiteSpace(p.VersionLabel) ? "V1.0" : p.VersionLabel
            },
            stages
        });
    }

    // ─── HELPERS ──────────────────────────────────────────────────────────────
    private static string NormalizePriority(string? p)
    {
        var v = (p ?? "").Trim();
        return v switch
        {
            "عاجل" => "عاجل",
            "عالي" or "عالية" => "عالي",
            "منخفض" or "منخفضة" => "منخفض",
            _ => "متوسط"
        };
    }

    private static IEnumerable<object> ProcedureStages(WorkProcedure? p, List<FormStatus> allStatuses)
    {
        if (p == null) yield break;
        var steps = ParseWorkflowSteps(p);
        foreach (var st in steps.OrderBy(s => s.SortOrder))
        {
            if (!st.FormStatusId.HasValue) continue;
            var fs = allStatuses.FirstOrDefault(x => x.Id == st.FormStatusId.Value);
            if (fs == null) continue;
            yield return new
            {
                stepId = st.Id,
                stepSortOrder = st.SortOrder,
                statusId = fs.Id,
                name = fs.Name,
                color = fs.Color,
                statusCategory = fs.StatusCategory,
                expectedDays = st.ExpectedDurationDays,
                expectedHours = st.ExpectedDurationHours
            };
        }
    }

    private static List<WorkflowStepDto> ParseWorkflowSteps(WorkProcedure? p)
    {
        if (p == null || string.IsNullOrWhiteSpace(p.WorkflowStepsJson)) return new();
        try
        {
            return JsonSerializer.Deserialize<List<WorkflowStepDto>>(p.WorkflowStepsJson, WorkflowJsonOpts) ?? new();
        }
        catch { return new(); }
    }

    private static DateTime? ComputeDueAt(DateTime submittedAt, WorkflowStepDto? step)
    {
        if (step == null) return null;
        var totalHours = 0.0;
        if (double.TryParse(step.ExpectedDurationDays, out var d) && d > 0) totalHours += d * 24.0;
        if (double.TryParse(step.ExpectedDurationHours, out var h) && h > 0) totalHours += h;
        if (totalHours <= 0) return null;
        return submittedAt.AddHours(totalHours);
    }

    /// <summary>
    /// SLA: مبكر إن أُغلق قبل الموعد، في الموعد إن أُغلق ضمنه، متأخر إن تجاوز،
    /// تم التصعيد عند رفع علم التصعيد. للطلبات المفتوحة: مبكر إن لم يتجاوز نصف المدة،
    /// في الموعد إن في المنتصف، متأخر إن تجاوز.
    /// </summary>
    private static string ComputeSlaState(OutboxRequest r)
    {
        if (r.IsEscalated) return "تم التصعيد";
        if (!r.ExpectedDueAt.HasValue) return "في الموعد";

        if (r.ClosedAt.HasValue)
        {
            if (r.ClosedAt.Value <= r.ExpectedDueAt.Value)
            {
                var total = (r.ExpectedDueAt.Value - r.SubmittedAt).TotalMinutes;
                var used = (r.ClosedAt.Value - r.SubmittedAt).TotalMinutes;
                if (total > 0 && used <= total * 0.6) return "مبكر";
                return "في الموعد";
            }
            return "متأخر";
        }

        var now = DateTime.Now;
        if (now > r.ExpectedDueAt.Value) return "متأخر";
        var totalOpen = (r.ExpectedDueAt.Value - r.SubmittedAt).TotalMinutes;
        var usedOpen = (now - r.SubmittedAt).TotalMinutes;
        if (totalOpen > 0 && usedOpen <= totalOpen * 0.6) return "مبكر";
        return "في الموعد";
    }

    private class WorkflowStepDto
    {
        public int Id { get; set; }
        public int SortOrder { get; set; }
        public string StepLabel { get; set; } = "";
        public int ExecutorRoleId { get; set; }
        public string ExpectedDurationDays { get; set; } = "";
        public string ExpectedDurationHours { get; set; } = "";
        public int? FormStatusId { get; set; }
        public string AssigneeMode { get; set; } = "specific";
        public string AssigneeFixedType { get; set; } = "";
        public int? AssigneeOrgUnitId { get; set; }
    }

    /// <summary>
    /// يستخرج قائمة المستخدمين المستهدفين بالخطوة الأولى من سير العمل،
    /// مع تحديد سبب الاختيار (specific / unit_manager / unit_representative).
    /// </summary>
    private async Task<List<RecipientCandidate>> ResolveFirstStepRecipientsAsync(WorkProcedure proc, WorkflowStepDto firstStep)
    {
        var results = new List<RecipientCandidate>();
        if (firstStep == null) return results;

        var beneficiaries = await _ds.ListBeneficiariesAsync();
        var users = await _ds.ListUsersAsync();
        var unitsAll = await _ds.ListOrganizationalUnitsAsync();
        var targetOrgIds = ParseIntArray(proc.TargetOrganizationalUnitIdsJson);

        // المستفيد → User (عبر username)
        User? UserOfBeneficiary(Beneficiary b)
        {
            if (string.IsNullOrWhiteSpace(b.Username)) return null;
            return users.FirstOrDefault(u => string.Equals(u.Username?.Trim(), b.Username.Trim(), StringComparison.OrdinalIgnoreCase));
        }

        var mode = (firstStep.AssigneeMode ?? "specific").Trim().ToLowerInvariant();

        if (mode == "specific")
        {
            // عبر دور المنفذين: ExecutorRoleId → ExecutorIds (CSV) → Beneficiaries → Users
            if (firstStep.ExecutorRoleId > 0)
            {
                var roles = await _ds.ListExecutorRolesAsync();
                var role = roles.FirstOrDefault(r => r.Id == firstStep.ExecutorRoleId);
                if (role != null)
                {
                    foreach (var bid in ParseCsvIntIds(role.ExecutorIds))
                    {
                        var b = beneficiaries.FirstOrDefault(x => x.Id == bid && x.IsActive);
                        if (b == null) continue;
                        var u = UserOfBeneficiary(b);
                        if (u == null) continue;
                        AddIfNew(results, u, b, "specific", unitsAll);
                    }
                }
            }
        }
        else if (mode == "fixed")
        {
            var ft = (firstStep.AssigneeFixedType ?? "").Trim().ToLowerInvariant();

            // الوحدات المستهدفة للبحث: AssigneeOrgUnitId إن وُجد، وإلا الوحدات المستهدفة في الإجراء
            var scopeUnitIds = new List<int>();
            if (firstStep.AssigneeOrgUnitId.HasValue && firstStep.AssigneeOrgUnitId.Value > 0)
                scopeUnitIds.Add(firstStep.AssigneeOrgUnitId.Value);
            else
                scopeUnitIds.AddRange(targetOrgIds);

            if (ft == "unit_manager")
            {
                foreach (var b in beneficiaries.Where(x => x.IsActive && x.IsUnitManager && x.OrganizationalUnitId.HasValue && scopeUnitIds.Contains(x.OrganizationalUnitId.Value)))
                {
                    var u = UserOfBeneficiary(b);
                    if (u == null) continue;
                    AddIfNew(results, u, b, "unit_manager", unitsAll);
                }
            }
            else if (ft == "unit_representative")
            {
                foreach (var b in beneficiaries.Where(x => x.IsActive && (x.SubRole ?? "").Trim() == "ممثل الوحدة التنظيمية" && x.OrganizationalUnitId.HasValue && scopeUnitIds.Contains(x.OrganizationalUnitId.Value)))
                {
                    var u = UserOfBeneficiary(b);
                    if (u == null) continue;
                    AddIfNew(results, u, b, "unit_representative", unitsAll);
                }
            }
            // باقي الأنماط (employee/direct_manager/managers_chain) — خارج النطاق المتفق عليه حالياً.
        }

        return results;
    }

    private static void AddIfNew(List<RecipientCandidate> list, User u, Beneficiary b, string via, List<OrganizationalUnit> units)
    {
        if (list.Any(x => x.UserId == u.Id)) return;
        var unitName = (b.OrganizationalUnitId.HasValue
            ? units.FirstOrDefault(o => o.Id == b.OrganizationalUnitId.Value)?.Name
            : null) ?? "";
        list.Add(new RecipientCandidate
        {
            UserId = u.Id,
            Username = u.Username ?? "",
            FullName = !string.IsNullOrWhiteSpace(u.FullName) ? u.FullName : b.FullName,
            Dept = unitName,
            BeneficiaryId = b.Id,
            AssignedVia = via
        });
    }

    private static IEnumerable<int> ParseCsvIntIds(string? csv)
    {
        if (string.IsNullOrWhiteSpace(csv)) yield break;
        foreach (var part in csv.Split(',', StringSplitOptions.RemoveEmptyEntries))
        {
            if (int.TryParse(part.Trim(), out var n) && n > 0) yield return n;
        }
    }

    private class RecipientCandidate
    {
        public int UserId { get; set; }
        public string Username { get; set; } = "";
        public string FullName { get; set; } = "";
        public string Dept { get; set; } = "";
        public int BeneficiaryId { get; set; }
        public string AssignedVia { get; set; } = "specific";
    }
}
