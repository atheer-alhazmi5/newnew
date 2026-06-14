using FormsSystem.Models.Entities;
using FormsSystem.Services;
using Microsoft.AspNetCore.Mvc;

namespace FormsSystem.Controllers;

public class DashboardController : BaseController
{
    private readonly DataService _ds;
    private readonly UiHelperService _ui;

    public DashboardController(DataService ds, UiHelperService ui) { _ds = ds; _ui = ui; }

    public IActionResult Index()
    {
        var auth = RequireAuth();
        if (auth != null) return auth;
        SetViewBagUser(_ui);
        ViewBag.PageName = "لوحة المعلومات";
        ViewBag.Title = "لوحة المعلومات";
        return View();
    }

    [HttpGet]
    public async Task<IActionResult> GetSummary()
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });

        var counts = await _ds.GetDashboardSummaryCountsAsync(CurrentUserId, CurrentUserName);
        var statusStats = await _ds.GetDashboardRequestStatusStatsAsync(CurrentUserId);
        var totalRequests = statusStats.Sum(x => x.count);

        return Json(new
        {
            success = true,
            cards = new
            {
                inbox = counts.inbox,
                outbox = counts.outbox,
                notifications = counts.notifications,
                delegations = counts.delegations
            },
            chart = new
            {
                title = "النسبة المئوية لعدد الطلبات حسب الحالة",
                labels = statusStats.Select(x => x.label).ToList(),
                counts = statusStats.Select(x => x.count).ToList(),
                percents = statusStats.Select(x =>
                    totalRequests == 0 ? 0.0 : Math.Round(x.count * 100.0 / totalRequests, 1)).ToList(),
                total = totalRequests
            }
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetProfile()
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });

        var user = await _ds.GetUserByIdAsync(CurrentUserId);
        if (user == null) return Json(new { success = false, message = "تعذّر تحميل بيانات المستخدم" });

        var beneficiary = await _ds.ResolveBeneficiaryForUserAsync(user);

        var orgUnits = await _ds.ListOrganizationalUnitsAsync();
        var depts = await _ds.ListDepartmentsAsync();
        var orgUnitName = ResolveOrgUnitName(user.DepartmentId, beneficiary?.OrganizationalUnitId, depts, orgUnits);
        var roleInUnit = beneficiary?.RoleDisplayTable ?? user.RoleLabel;
        var canEditEndorsementSignature = beneficiary != null
            && string.IsNullOrWhiteSpace(beneficiary.EndorsementFile)
            && string.IsNullOrWhiteSpace(beneficiary.SignatureFile);

        var executorRoles = beneficiary != null
            ? await _ds.ListExecutorRolesForBeneficiaryAsync(beneficiary.Id)
            : new List<ExecutorRole>();

        return Json(new
        {
            success = true,
            profile = new
            {
                photoUrl = !string.IsNullOrWhiteSpace(beneficiary?.PhotoUrl) ? beneficiary.PhotoUrl : user.PhotoUrl,
                fullName = !string.IsNullOrWhiteSpace(beneficiary?.FullName) ? beneficiary.FullName : user.FullName,
                phone = beneficiary?.Phone ?? user.Phone ?? "",
                organizationalUnit = orgUnitName,
                roleInUnit,
                email = beneficiary?.Email ?? user.Email ?? "",
                nationalId = beneficiary?.NationalId ?? user.NationalId ?? "",
                endorsementType = beneficiary?.EndorsementType ?? "",
                endorsementFile = beneficiary?.EndorsementFile ?? "",
                signatureType = beneficiary?.SignatureType ?? "",
                signatureFile = beneficiary?.SignatureFile ?? ""
            },
            canEditEndorsementSignature,
            executorRoles = executorRoles.Select((r, idx) => new
            {
                rowNum = idx + 1,
                r.Name,
                r.Description,
                r.Ownership
            }).ToList()
        });
    }

    [HttpPost]
    public async Task<IActionResult> SaveMyEndorsementSignature([FromBody] SaveMyEndorsementSignatureRequest req)
    {
        if (!IsAuthenticated)
            return Json(new { success = false, message = "غير مصرح" });

        var user = await _ds.GetUserByIdAsync(CurrentUserId);
        if (user == null)
            return Json(new { success = false, message = "تعذّر تحميل بيانات المستخدم" });

        var beneficiary = await _ds.ResolveBeneficiaryForUserAsync(user);
        if (beneficiary == null)
            return Json(new { success = false, message = "لا يوجد سجل مستفيد مرتبط بحسابك" });

        if (!string.IsNullOrWhiteSpace(beneficiary.EndorsementFile) || !string.IsNullOrWhiteSpace(beneficiary.SignatureFile))
            return Json(new { success = false, message = "تم حفظ التأشير والتوقيع مسبقاً ولا يمكن تعديلهما" });

        var endorsementType = (req.EndorsementType ?? "").Trim();
        var signatureType = (req.SignatureType ?? "").Trim();
        if (endorsementType != "مرفق" && endorsementType != "التوقيع بالقلم")
            return Json(new { success = false, message = "نوع التأشير غير صالح" });
        if (signatureType != "مرفق" && signatureType != "التوقيع بالقلم")
            return Json(new { success = false, message = "نوع التوقيع غير صالح" });

        var endorsementFile = (req.EndorsementFile ?? "").Trim();
        var signatureFile = (req.SignatureFile ?? "").Trim();
        if (string.IsNullOrWhiteSpace(endorsementFile))
            return Json(new { success = false, message = "التأشير مطلوب" });
        if (string.IsNullOrWhiteSpace(signatureFile))
            return Json(new { success = false, message = "التوقيع مطلوب" });

        beneficiary.EndorsementType = endorsementType;
        beneficiary.EndorsementFile = endorsementFile;
        beneficiary.SignatureType = signatureType;
        beneficiary.SignatureFile = signatureFile;

        await _ds.UpdateBeneficiaryAsync(beneficiary);
        await _ds.AddAuditLogAsync(BuildAuditEntry("حفظ التأشير والتوقيع", "Beneficiary", beneficiary.Id.ToString(), beneficiary.FullName));

        return Json(new { success = true, message = "تم حفظ التأشير والتوقيع بنجاح" });
    }

    [HttpGet]
    public async Task<IActionResult> GetMyAuditLogs()
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });

        var logs = await _ds.ListAuditLogsByUserIdAsync(CurrentUserId);
        var actions = logs.Select(l => l.Action).Where(a => !string.IsNullOrWhiteSpace(a)).Distinct()
            .OrderBy(a => a, StringComparer.Create(new System.Globalization.CultureInfo("ar-SA"), false)).ToList();

        return Json(new
        {
            success = true,
            actions,
            data = logs.Select((l, idx) => new
            {
                l.Id,
                RowNum = idx + 1,
                l.Action,
                CreatedAt = l.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss"),
                l.Browser,
                l.IpAddress,
                l.OperatingSystem
            }).ToList()
        });
    }

    private static string ResolveOrgUnitName(int? userDeptId, int? beneficiaryOuId, IEnumerable<Department> depts, IEnumerable<OrganizationalUnit> orgUnits)
    {
        var ouId = beneficiaryOuId ?? userDeptId;
        if (!ouId.HasValue || ouId.Value <= 0) return "";
        var d = depts.FirstOrDefault(x => x.Id == ouId.Value);
        if (d != null && !string.IsNullOrWhiteSpace(d.Name)) return d.Name.Trim();
        var ou = orgUnits.FirstOrDefault(x => x.Id == ouId.Value);
        return ou?.Name?.Trim() ?? "";
    }
}

public class SaveMyEndorsementSignatureRequest
{
    public string? EndorsementType { get; set; }
    public string? EndorsementFile { get; set; }
    public string? SignatureType { get; set; }
    public string? SignatureFile { get; set; }
}
