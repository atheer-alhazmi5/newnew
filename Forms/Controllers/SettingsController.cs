using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using FormsSystem.Models.Entities;
using FormsSystem.Services;
using Microsoft.AspNetCore.Mvc;

namespace FormsSystem.Controllers;

/// <summary>صفحات الإعدادات العامة — يبدأ بـ «أنواع الإجراءات» (مطابقة لأسلوب «أنواع النماذج»).</summary>
public class SettingsController : BaseController
{
    private readonly DataService _ds;
    private readonly UiHelperService _ui;

    public SettingsController(DataService ds, UiHelperService ui)
    {
        _ds = ds;
        _ui = ui;
    }

    public IActionResult ProcedureActionTypes()
    {
        var auth = RequireAuth();
        if (auth != null) return auth;
        if (CurrentUserRole != "Admin")
            return RedirectToAction("Index", "Forms");
        SetViewBagUser(_ui);
        ViewBag.PageName = "أنواع الإجراءات";
        ViewBag.Title = "أنواع الإجراءات";
        return View("~/Views/Settings/ProcedureActionTypes.cshtml");
    }

    [HttpGet]
    public async Task<IActionResult> GetProcedureActionTypes(string? search, string? isActive)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var all = await _ds.ListProcedureActionTypesAsync();
        var filtered = all.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            filtered = filtered.Where(r =>
                (r.Name?.ToLower().Contains(s) ?? false) ||
                ((r.Description ?? "").ToLower().Contains(s)));
        }

        if (!string.IsNullOrWhiteSpace(isActive))
            filtered = filtered.Where(r => r.IsActive == (isActive == "1"));

        var result = filtered
            .Select(r => new
            {
                r.Id,
                r.Name,
                r.Description,
                r.SortOrder,
                r.IsActive,
                r.CreatedBy,
                CreatedAt = r.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
                r.UpdatedBy,
                UpdatedAt = r.UpdatedAt?.ToString("yyyy-MM-dd HH:mm")
            })
            .OrderBy(x => x.SortOrder)
            .ToList();

        return Json(new { success = true, data = result });
    }

    [HttpGet]
    public async Task<IActionResult> GetProcedureActionTypeDetails(int id)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var r = await _ds.GetProcedureActionTypeByIdAsync(id);
        if (r == null) return Json(new { success = false, message = "نوع الإجراء غير موجود" });

        return Json(new
        {
            success = true,
            data = new
            {
                r.Id,
                r.Name,
                r.Description,
                r.SortOrder,
                r.IsActive,
                r.CreatedBy,
                CreatedAt = r.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
                r.UpdatedBy,
                UpdatedAt = r.UpdatedAt?.ToString("yyyy-MM-dd HH:mm")
            }
        });
    }

    [HttpPost]
    public async Task<IActionResult> AddProcedureActionType([FromBody] ProcedureActionTypeRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });
        if (string.IsNullOrWhiteSpace(req.Name))
            return Json(new { success = false, message = "اسم نوع الإجراء مطلوب" });

        var trimmedName = req.Name.Trim();
        if (await _ds.IsProcedureActionTypeNameDuplicateAsync(trimmedName))
            return Json(new { success = false, message = "اسم نوع الإجراء موجود مسبقاً" });

        var all = await _ds.ListProcedureActionTypesAsync();
        var nextOrder = all.Count > 0 ? all.Max(x => x.SortOrder) + 1 : 1;

        var row = new ProcedureActionType
        {
            Name = trimmedName,
            Description = string.IsNullOrWhiteSpace(req.Description) ? "" : req.Description.Trim(),
            SortOrder = nextOrder,
            IsActive = req.IsActive,
            CreatedBy = CurrentUserFullName
        };

        await _ds.AddProcedureActionTypeAsync(row);
        await _ds.AddAuditLogAsync(BuildAuditEntry("إضافة نوع إجراء", "ProcedureActionType", row.Id.ToString(), row.Name ?? ""));
        return Json(new { success = true, message = "تم إنشاء نوع الإجراء بنجاح", id = row.Id });
    }

    [HttpPost]
    public async Task<IActionResult> UpdateProcedureActionType([FromBody] ProcedureActionTypeUpdateRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var r = await _ds.GetProcedureActionTypeByIdAsync(req.Id);
        if (r == null) return Json(new { success = false, message = "نوع الإجراء غير موجود" });
        if (string.IsNullOrWhiteSpace(req.Name))
            return Json(new { success = false, message = "اسم نوع الإجراء مطلوب" });

        var trimmedName = req.Name.Trim();
        if (await _ds.IsProcedureActionTypeNameDuplicateAsync(trimmedName, req.Id))
            return Json(new { success = false, message = "اسم نوع الإجراء موجود مسبقاً" });

        r.Name = trimmedName;
        r.Description = string.IsNullOrWhiteSpace(req.Description) ? "" : req.Description.Trim();
        r.IsActive = req.IsActive;
        r.UpdatedBy = CurrentUserFullName;
        r.UpdatedAt = DateTime.UtcNow;

        await _ds.UpdateProcedureActionTypeAsync(r);
        await _ds.AddAuditLogAsync(BuildAuditEntry("تحديث نوع إجراء", "ProcedureActionType", r.Id.ToString(), r.Name ?? ""));
        return Json(new { success = true, message = "تم تحديث نوع الإجراء بنجاح" });
    }

    [HttpPost]
    public async Task<IActionResult> DeleteProcedureActionType([FromBody] ProcedureActionTypeIdRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var r = await _ds.GetProcedureActionTypeByIdAsync(req.Id);
        if (r == null) return Json(new { success = false, message = "نوع الإجراء غير موجود" });

        if (await _ds.IsProcedureActionTypeLinkedAsync(req.Id))
            return Json(new { success = false, message = "لا يمكن حذف نوع الإجراء لارتباطه بسجلات أخرى" });

        await _ds.DeleteProcedureActionTypeAsync(req.Id);
        await _ds.AddAuditLogAsync(BuildAuditEntry("حذف نوع إجراء", "ProcedureActionType", req.Id.ToString(), r.Name ?? ""));
        return Json(new { success = true, message = "تم حذف نوع الإجراء بنجاح" });
    }

    [HttpPost]
    public async Task<IActionResult> ToggleProcedureActionType([FromBody] ProcedureActionTypeIdRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var r = await _ds.GetProcedureActionTypeByIdAsync(req.Id);
        if (r == null) return Json(new { success = false, message = "نوع الإجراء غير موجود" });

        r.IsActive = !r.IsActive;
        r.UpdatedBy = CurrentUserFullName;
        r.UpdatedAt = DateTime.UtcNow;
        await _ds.UpdateProcedureActionTypeAsync(r);
        await _ds.AddAuditLogAsync(BuildAuditEntry(
            r.IsActive ? "تفعيل نوع إجراء" : "تعطيل نوع إجراء", "ProcedureActionType", r.Id.ToString(), r.Name ?? ""));
        return Json(new
        {
            success = true,
            message = r.IsActive ? "تم تفعيل نوع الإجراء" : "تم تعطيل نوع الإجراء",
            isActive = r.IsActive
        });
    }

    [HttpPost]
    public async Task<IActionResult> ReorderProcedureActionType([FromBody] ProcedureActionTypeReorderRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });
        if (req.Id <= 0 || req.NewOrder <= 0)
            return Json(new { success = false, message = "بيانات الترتيب غير صالحة" });

        var r = await _ds.GetProcedureActionTypeByIdAsync(req.Id);
        if (r == null) return Json(new { success = false, message = "نوع الإجراء غير موجود" });

        await _ds.ReorderProcedureActionTypesAsync(req.Id, req.NewOrder);
        await _ds.AddAuditLogAsync(BuildAuditEntry("إعادة ترتيب نوع إجراء", "ProcedureActionType", req.Id.ToString(), r.Name ?? ""));
        return Json(new { success = true, message = "تم تحديث الترتيب" });
    }

    // ─── التفويضات (إعدادات المشرف) ───────────────────────────────────────────

    public IActionResult Delegations()
    {
        var auth = RequireAuth();
        if (auth != null) return auth;
        if (CurrentUserRole != "Admin")
            return RedirectToAction("Index", "Forms");
        SetViewBagUser(_ui);
        return View("~/Views/Settings/Delegations.cshtml");
    }

    [HttpGet]
    public async Task<IActionResult> GetDelegations()
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var list = await _ds.ListDelegationsAsync();
        var bens = await _ds.ListBeneficiariesAsync();
        var units = await _ds.ListOrganizationalUnitsAsync();
        var activeUnits = units.Where(u => u.IsActive).OrderBy(u => u.SortOrder).ToList();
        var data = list.Select(d => MapDelegationRow(d, bens, units)).ToList();
        return Json(new
        {
            success = true,
            data,
            beneficiaries = bens.Where(b => b.IsActive).ToList(),
            organizationalUnits = activeUnits.Select(u => new { u.Id, u.Name, u.ParentId, u.SortOrder }).ToList()
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetMyDelegations()
    {
        if (!IsAuthenticated)
            return Json(new { success = false, message = "غير مصرح" });

        var me = await FindBeneficiaryForCurrentUserAsync();
        if (me == null)
            return Json(new { success = true, data = Array.Empty<object>() });

        var list = await _ds.ListDelegationsAsync();
        var mine = list.Where(d => d.DelegatorBeneficiaryId == me.Id || d.DelegateeBeneficiaryId == me.Id).ToList();
        var bens = await _ds.ListBeneficiariesAsync();
        var units = await _ds.ListOrganizationalUnitsAsync();
        var data = mine.Select(d => MapDelegationRow(d, bens, units)).ToList();
        return Json(new { success = true, data });
    }

    [HttpGet]
    public async Task<IActionResult> GetDelegation(int id)
    {
        if (!IsAuthenticated)
            return Json(new { success = false, message = "غير مصرح" });

        var d = await _ds.GetDelegationByIdAsync(id);
        if (d == null) return Json(new { success = false, message = "التفويض غير موجود" });

        if (CurrentUserRole != "Admin")
        {
            var me = await FindBeneficiaryForCurrentUserAsync();
            if (me == null || (d.DelegatorBeneficiaryId != me.Id && d.DelegateeBeneficiaryId != me.Id))
                return Json(new { success = false, message = "غير مصرح" });
        }

        var bens = await _ds.ListBeneficiariesAsync();
        var units = await _ds.ListOrganizationalUnitsAsync();
        return Json(new { success = true, data = MapDelegationRow(d, bens, units, includeMeta: true) });
    }

    [HttpPost]
    public async Task<IActionResult> AddDelegation([FromBody] DelegationSaveRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var val = ValidateDelegationCore(req.ReferenceNumber, req.DelegationReason, req.DelegatorBeneficiaryId,
            req.DelegatorOrgUnitId, req.DelegateeBeneficiaryId, req.DelegateeOrgUnitId, req.StartDate, req.EndDate,
            out var refNum, out var start, out var end, out var err);
        if (!val) return Json(new { success = false, message = err });

        if (await IsDelegationReferenceTakenAsync(refNum, excludeId: 0))
            return Json(new { success = false, message = "رقم المرجع مستخدم مسبقاً" });

        var bens = await _ds.ListBeneficiariesAsync();
        var vor = ValidateBeneficiaryOu(bens, req.DelegatorBeneficiaryId, req.DelegatorOrgUnitId, out err);
        if (!vor) return Json(new { success = false, message = err });
        var vee = ValidateBeneficiaryOu(bens, req.DelegateeBeneficiaryId, req.DelegateeOrgUnitId, out err);
        if (!vee) return Json(new { success = false, message = err });
        if (req.DelegatorBeneficiaryId == req.DelegateeBeneficiaryId)
            return Json(new { success = false, message = "المفوِّض والمفوَّض له يجب أن يكونا مختلفين" });

        var status = req.SaveAsDraft ? "draft" : "active";
        var row = new Delegation
        {
            ReferenceNumber = refNum,
            DelegationReason = req.DelegationReason!.Trim(),
            DelegatorBeneficiaryId = req.DelegatorBeneficiaryId,
            DelegatorOrgUnitId = req.DelegatorOrgUnitId,
            DelegateeBeneficiaryId = req.DelegateeBeneficiaryId,
            DelegateeOrgUnitId = req.DelegateeOrgUnitId,
            StartDate = start,
            EndDate = end,
            Status = status,
            CreatedBy = CurrentUserFullName
        };

        await _ds.AddDelegationAsync(row);
        await _ds.AddAuditLogAsync(BuildAuditEntry("إضافة تفويض", "Delegation", row.Id.ToString(), $"مرجع {row.ReferenceNumber}"));
        return Json(new { success = true, message = req.SaveAsDraft ? "تم حفظ المسودة" : "تم إنشاء التفويض", id = row.Id });
    }

    [HttpPost]
    public async Task<IActionResult> UpdateDelegation([FromBody] DelegationUpdateRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });
        if (req.Id <= 0)
            return Json(new { success = false, message = "معرّف غير صالح" });

        var existing = await _ds.GetDelegationByIdAsync(req.Id);
        if (existing == null) return Json(new { success = false, message = "التفويض غير موجود" });

        if (req.Cancel)
        {
            var reason = (req.CancellationReason ?? "").Trim();
            if (string.IsNullOrEmpty(reason))
                return Json(new { success = false, message = "سبب إلغاء التفويض مطلوب" });
            if (string.Equals(existing.Status, "cancelled", StringComparison.OrdinalIgnoreCase))
                return Json(new { success = false, message = "التفويض ملغى مسبقاً" });

            existing.Status = "cancelled";
            existing.CancellationReason = reason;
            existing.UpdatedBy = CurrentUserFullName;
            existing.UpdatedAt = DateTime.UtcNow;
            await _ds.UpdateDelegationAsync(existing);
            await _ds.AddAuditLogAsync(BuildAuditEntry("إلغاء تفويض", "Delegation", existing.Id.ToString(), $"مرجع {existing.ReferenceNumber}"));
            return Json(new { success = true, message = "تم إلغاء التفويض" });
        }

        var effectiveState = ResolveDelegationStatusCode(existing);
        if (string.Equals(effectiveState, "cancelled", StringComparison.OrdinalIgnoreCase)
            || string.Equals(effectiveState, "expired", StringComparison.OrdinalIgnoreCase))
            return Json(new { success = false, message = "لا يمكن تعديل تفويض منتهي أو ملغى" });

        var val = ValidateDelegationCore(req.ReferenceNumber, req.DelegationReason, req.DelegatorBeneficiaryId,
            req.DelegatorOrgUnitId, req.DelegateeBeneficiaryId, req.DelegateeOrgUnitId, req.StartDate, req.EndDate,
            out var refNum, out var start, out var end, out var err);
        if (!val) return Json(new { success = false, message = err });

        if (await IsDelegationReferenceTakenAsync(refNum, excludeId: req.Id))
            return Json(new { success = false, message = "رقم المرجع مستخدم مسبقاً" });

        var bens = await _ds.ListBeneficiariesAsync();
        var vor = ValidateBeneficiaryOu(bens, req.DelegatorBeneficiaryId, req.DelegatorOrgUnitId, out err);
        if (!vor) return Json(new { success = false, message = err });
        var vee = ValidateBeneficiaryOu(bens, req.DelegateeBeneficiaryId, req.DelegateeOrgUnitId, out err);
        if (!vee) return Json(new { success = false, message = err });
        if (req.DelegatorBeneficiaryId == req.DelegateeBeneficiaryId)
            return Json(new { success = false, message = "المفوِّض والمفوَّض له يجب أن يكونا مختلفين" });

        var effectiveBefore = ResolveDelegationStatusCode(existing);
        if (string.Equals(effectiveBefore, "active", StringComparison.OrdinalIgnoreCase))
        {
            if (start.Date < DateTime.Today)
                return Json(new
                {
                    success = false,
                    message = "تفويض سارٍ لا يمكن جعل تاريخ بدايته قبل تاريخ اليوم. إذا احتجت تعديلاً يخص فترة سابقة، أنشئ تفويضاً جديداً أو انتهِ من الإصدار الحالي أولاً."
                });
        }

        existing.ReferenceNumber = refNum;
        existing.DelegationReason = req.DelegationReason!.Trim();
        existing.DelegatorBeneficiaryId = req.DelegatorBeneficiaryId;
        existing.DelegatorOrgUnitId = req.DelegatorOrgUnitId;
        existing.DelegateeBeneficiaryId = req.DelegateeBeneficiaryId;
        existing.DelegateeOrgUnitId = req.DelegateeOrgUnitId;
        existing.StartDate = start;
        existing.EndDate = end;
        var stored = (existing.Status ?? "").Trim();
        if (string.Equals(stored, "draft", StringComparison.OrdinalIgnoreCase))
            existing.Status = "active";
        existing.UpdatedBy = CurrentUserFullName;
        existing.UpdatedAt = DateTime.UtcNow;

        await _ds.UpdateDelegationAsync(existing);
        await _ds.AddAuditLogAsync(BuildAuditEntry("تحديث تفويض", "Delegation", existing.Id.ToString(), $"مرجع {existing.ReferenceNumber}"));
        return Json(new { success = true, message = "تم التحديث" });
    }

    [HttpPost]
    public async Task<IActionResult> DeleteDelegation([FromBody] DelegationIdRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });
        var d = await _ds.GetDelegationByIdAsync(req.Id);
        if (d == null) return Json(new { success = false, message = "غير موجود" });
        if (!string.Equals((d.Status ?? "").Trim(), "draft", StringComparison.OrdinalIgnoreCase))
            return Json(new { success = false, message = "يمكن حذف المسودات فقط" });

        await _ds.DeleteDelegationAsync(req.Id);
        await _ds.AddAuditLogAsync(BuildAuditEntry("حذف تفويض", "Delegation", req.Id.ToString(), $"مرجع {d.ReferenceNumber}"));
        return Json(new { success = true, message = "تم الحذف" });
    }

    private async Task<Beneficiary?> FindBeneficiaryForCurrentUserAsync()
    {
        var bens = await _ds.ListBeneficiariesAsync();
        return bens.FirstOrDefault(b =>
            (!string.IsNullOrEmpty(CurrentUserNationalId) && b.NationalId == CurrentUserNationalId) ||
            (!string.IsNullOrEmpty(b.Username) && string.Equals(b.Username, CurrentUserName, StringComparison.OrdinalIgnoreCase)));
    }

    private async Task<bool> IsDelegationReferenceTakenAsync(int referenceNumber, int excludeId)
    {
        if (referenceNumber <= 0) return false;
        var list = await _ds.ListDelegationsAsync();
        return list.Any(d => d.ReferenceNumber == referenceNumber && d.Id != excludeId);
    }

    private static string ResolveDelegationStatusCode(Delegation d)
    {
        var st = (d.Status ?? "").Trim();
        if (st.Equals("cancelled", StringComparison.OrdinalIgnoreCase)) return "cancelled";
        if (st.Equals("draft", StringComparison.OrdinalIgnoreCase)) return "draft";
        var today = DateTime.Today;
        var sd = d.StartDate.Date;
        var ed = d.EndDate.Date;
        if (today < sd) return "scheduled";
        if (today > ed) return "expired";
        return "active";
    }

    private static object MapDelegationRow(Delegation d, List<Beneficiary> bens, List<OrganizationalUnit> units,
        bool includeMeta = false)
    {
        var benById = bens.ToDictionary(b => b.Id);
        benById.TryGetValue(d.DelegatorBeneficiaryId, out var dor);
        benById.TryGetValue(d.DelegateeBeneficiaryId, out var dee);
        var uById = units.ToDictionary(u => u.Id);
        uById.TryGetValue(d.DelegatorOrgUnitId, out var dorU);
        uById.TryGetValue(d.DelegateeOrgUnitId, out var deeU);

        var startStr = d.StartDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var endStr = d.EndDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var statusCode = ResolveDelegationStatusCode(d);

        var row = new Dictionary<string, object?>
        {
            ["id"] = d.Id,
            ["referenceNumber"] = d.ReferenceNumber,
            ["delegationReason"] = d.DelegationReason ?? "",
            ["delegatorBeneficiaryId"] = d.DelegatorBeneficiaryId,
            ["delegateeBeneficiaryId"] = d.DelegateeBeneficiaryId,
            ["delegatorOrgUnitId"] = d.DelegatorOrgUnitId,
            ["delegateeOrgUnitId"] = d.DelegateeOrgUnitId,
            ["startDate"] = startStr,
            ["endDate"] = endStr,
            ["statusCode"] = statusCode,
            ["delegatorName"] = dor?.FullName ?? "",
            ["delegatorRoleDisplay"] = dor?.RoleDisplayTable ?? dor?.RoleDisplay ?? "",
            ["delegateeName"] = dee?.FullName ?? "",
            ["delegateeRoleDisplay"] = dee?.RoleDisplayTable ?? dee?.RoleDisplay ?? "",
            ["delegatorOrgUnitName"] = dorU?.Name ?? "",
            ["delegateeOrgUnitName"] = deeU?.Name ?? ""
        };

        if (!includeMeta) return row;

        row["cancellationReason"] = string.IsNullOrWhiteSpace(d.CancellationReason) ? "" : d.CancellationReason;
        row["status"] = d.Status;
        row["createdBy"] = d.CreatedBy;
        row["createdAt"] = d.CreatedAt.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture);
        row["updatedBy"] = d.UpdatedBy ?? "";
        row["updatedAt"] = d.UpdatedAt?.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture) ?? "";
        return row;
    }

    private static bool ValidateDelegationCore(
        int? referenceNumber,
        string? delegationReason,
        int delegatorBeneficiaryId,
        int delegatorOrgUnitId,
        int delegateeBeneficiaryId,
        int delegateeOrgUnitId,
        string? startDate,
        string? endDate,
        out int refOut,
        out DateTime start,
        out DateTime end,
        out string err)
    {
        refOut = 0;
        start = default;
        end = default;
        err = "";

        if (string.IsNullOrWhiteSpace(delegationReason))
        {
            err = "سبب التفويض مطلوب";
            return false;
        }
        if (referenceNumber is null or <= 0 or > 2147483647)
        {
            err = "المرجع مطلوب ويجب أن يكون رقماً صحيحاً أكبر من صفر";
            return false;
        }
        refOut = referenceNumber!.Value;

        if (delegatorOrgUnitId <= 0 || delegateeOrgUnitId <= 0
            || delegatorBeneficiaryId <= 0 || delegateeBeneficiaryId <= 0)
        {
            err = "بيانات المفوِّض أو المفوَّض له غير كاملة";
            return false;
        }

        if (!TryParseIsoDate(startDate, out start) || !TryParseIsoDate(endDate, out end))
        {
            err = "تواريخ البداية والنهاية مطلوبة بصيغة صحيحة";
            return false;
        }
        if (end.Date < start.Date)
        {
            err = "تاريخ النهاية يجب ألا يكون قبل تاريخ البداية";
            return false;
        }

        return true;
    }

    private static bool TryParseIsoDate(string? s, out DateTime dt)
    {
        dt = default;
        if (string.IsNullOrWhiteSpace(s)) return false;
        return DateTime.TryParseExact(s.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture,
            DateTimeStyles.None, out dt);
    }

    private static bool ValidateBeneficiaryOu(List<Beneficiary> bens, int beneficiaryId, int orgUnitId, out string err)
    {
        err = "";
        var b = bens.FirstOrDefault(x => x.Id == beneficiaryId);
        if (b == null)
        {
            err = "مستفيد غير موجود";
            return false;
        }
        var bou = b.OrganizationalUnitId ?? 0;
        if (bou != orgUnitId)
        {
            err = "المستفيد المختار لا ينتمي للوحدة التنظيمية المحددة";
            return false;
        }
        return true;
    }
}

public class ProcedureActionTypeRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
}

public class ProcedureActionTypeUpdateRequest : ProcedureActionTypeRequest
{
    public int Id { get; set; }
}

public class ProcedureActionTypeIdRequest
{
    public int Id { get; set; }
}

public class ProcedureActionTypeReorderRequest
{
    public int Id { get; set; }
    public int NewOrder { get; set; }
}

public class DelegationSaveRequest
{
    public int? ReferenceNumber { get; set; }
    public string? DelegationReason { get; set; }
    public int DelegatorBeneficiaryId { get; set; }
    public int DelegatorOrgUnitId { get; set; }
    public int DelegateeBeneficiaryId { get; set; }
    public int DelegateeOrgUnitId { get; set; }
    public string? StartDate { get; set; }
    public string? EndDate { get; set; }
    public bool SaveAsDraft { get; set; }
}

public class DelegationUpdateRequest : DelegationSaveRequest
{
    public int Id { get; set; }
    public bool Cancel { get; set; }
    public string? CancellationReason { get; set; }
}

public class DelegationIdRequest
{
    public int Id { get; set; }
}
