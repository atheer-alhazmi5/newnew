using FormsSystem.Models.Entities;
using FormsSystem.Services;
using Microsoft.AspNetCore.Mvc;

namespace FormsSystem.Controllers;

public class SystemEvaluationController : BaseController
{
    private readonly DataService _ds;
    private readonly UiHelperService _ui;

    public SystemEvaluationController(DataService ds, UiHelperService ui)
    {
        _ds = ds;
        _ui = ui;
    }

    public IActionResult Index()
    {
        var auth = RequireAuth();
        if (auth != null) return auth;
        SetViewBagUser(_ui);
        ViewBag.IsAdmin = CurrentUserRole == "Admin";
        return View();
    }

    [HttpGet]
    public async Task<IActionResult> GetEvaluations()
    {
        if (!IsAuthenticated)
            return Json(new { success = false, message = "غير مصرح" });

        var isAdmin = CurrentUserRole == "Admin";
        var all = await _ds.ListSystemFeedbacksAsync();
        var myFeedback = await _ds.GetSystemFeedbackByUserIdAsync(CurrentUserId);
        var published = all.Where(f => f.IsPublished).ToList();
        var visible = isAdmin ? all : published;

        var levels = DataService.SystemFeedbackRatingLevels;
        var dimensions = new[] { "سهولة الاستخدام", "التصميم", "سرعة الأداء", "الدعم الفني" };

        int CountDim(string dim, string level)
            => published.Count(f => GetDimensionRating(f, dim) == level);

        var detailStats = dimensions.Select(dim => new
        {
            dimension = dim,
            counts = levels.ToDictionary(l => l, l => CountDim(dim, l))
        }).ToList();

        var overallCounts = levels.ToDictionary(l => l, l => published.Count(f => f.OverallRating == l));
        var totalOverall = published.Count;
        var overallPercents = levels.ToDictionary(
            l => l,
            l => totalOverall == 0 ? 0.0 : Math.Round(overallCounts[l] * 100.0 / totalOverall, 1));

        return Json(new
        {
            success = true,
            isAdmin,
            hasSubmitted = myFeedback != null,
            canSubmit = myFeedback == null,
            ratingLevels = levels,
            dimensions,
            detailStats,
            overallCounts,
            overallPercents,
            totalCount = published.Count,
            data = visible.Select((f, idx) => new
            {
                id = f.Id,
                rowNum = idx + 1,
                submitterName = f.SubmitterName,
                organizationalUnitName = f.OrganizationalUnitName,
                createdAt = f.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
                overallRating = f.OverallRating,
                easeOfUse = f.EaseOfUse,
                design = f.Design,
                performance = f.Performance,
                technicalSupport = f.TechnicalSupport,
                notes = f.Notes,
                isPublished = f.IsPublished
            })
        });
    }

    [HttpPost]
    public async Task<IActionResult> Submit([FromBody] SystemFeedbackSubmitRequest req)
    {
        if (!IsAuthenticated)
            return Json(new { success = false, message = "غير مصرح" });

        if (await _ds.GetSystemFeedbackByUserIdAsync(CurrentUserId) != null)
            return Json(new { success = false, message = "تم إرسال تقييمك مسبقاً — التقييم مرة واحدة فقط لكل مستخدم" });

        var user = await _ds.GetUserByIdAsync(CurrentUserId);
        if (user == null)
            return Json(new { success = false, message = "تعذّر تحديد المستخدم الحالي" });

        var overall = DataService.NormalizeFeedbackRating(req.OverallRating);
        var ease = DataService.NormalizeFeedbackRating(req.EaseOfUse);
        var design = DataService.NormalizeFeedbackRating(req.Design);
        var perf = DataService.NormalizeFeedbackRating(req.Performance);
        var support = DataService.NormalizeFeedbackRating(req.TechnicalSupport);

        if (string.IsNullOrEmpty(overall)) return Json(new { success = false, message = "يرجى اختيار التقييم العام" });
        if (string.IsNullOrEmpty(ease)) return Json(new { success = false, message = "يرجى اختيار تقييم سهولة الاستخدام" });
        if (string.IsNullOrEmpty(design)) return Json(new { success = false, message = "يرجى اختيار تقييم التصميم" });
        if (string.IsNullOrEmpty(perf)) return Json(new { success = false, message = "يرجى اختيار تقييم سرعة الأداء" });
        if (string.IsNullOrEmpty(support)) return Json(new { success = false, message = "يرجى اختيار تقييم الدعم الفني" });

        var depts = await _ds.ListDepartmentsAsync();
        var orgUnits = await _ds.ListOrganizationalUnitsAsync();
        var ouName = ResolveUnitDisplayName(user.DepartmentId, depts, orgUnits);
        if (string.IsNullOrEmpty(ouName)) ouName = CurrentDeptName;

        var row = new SystemFeedback
        {
            UserId = CurrentUserId,
            SubmitterName = user.FullName,
            OrganizationalUnitId = user.DepartmentId,
            OrganizationalUnitName = ouName,
            OverallRating = overall,
            EaseOfUse = ease,
            Design = design,
            Performance = perf,
            TechnicalSupport = support,
            Notes = (req.Notes ?? "").Trim(),
            IsPublished = false,
            CreatedAt = DateTime.UtcNow
        };

        await _ds.AddSystemFeedbackAsync(row);
        await _ds.AddAuditLogAsync(BuildAuditEntry("إرسال تقييم نظام", "SystemFeedback", row.Id.ToString(), user.FullName));

        return Json(new { success = true, message = "شكراً لتقييمك!" });
    }

    [HttpPost]
    public async Task<IActionResult> SetPublish([FromBody] SystemFeedbackPublishRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var item = await _ds.GetSystemFeedbackByIdAsync(req.Id);
        if (item == null)
            return Json(new { success = false, message = "غير موجود" });

        item.IsPublished = req.Publish;
        await _ds.UpdateSystemFeedbackAsync(item);
        await _ds.AddAuditLogAsync(BuildAuditEntry(
            req.Publish ? "نشر تقييم نظام" : "إيقاف نشر تقييم نظام",
            "SystemFeedback",
            req.Id.ToString(),
            item.SubmitterName));

        return Json(new
        {
            success = true,
            isPublished = item.IsPublished,
            message = req.Publish ? "تم نشر التقييم" : "تم إيقاف نشر التقييم"
        });
    }

    [HttpPost]
    public async Task<IActionResult> TogglePublish([FromBody] SystemFeedbackIdRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var item = await _ds.GetSystemFeedbackByIdAsync(req.Id);
        if (item == null)
            return Json(new { success = false, message = "غير موجود" });

        return await SetPublish(new SystemFeedbackPublishRequest { Id = req.Id, Publish = !item.IsPublished });
    }

    private static string GetDimensionRating(SystemFeedback f, string dim) => dim switch
    {
        "سهولة الاستخدام" => f.EaseOfUse,
        "التصميم" => f.Design,
        "سرعة الأداء" => f.Performance,
        "الدعم الفني" => f.TechnicalSupport,
        _ => ""
    };

    private static string ResolveUnitDisplayName(int? departmentId, IEnumerable<Department> depts, IEnumerable<OrganizationalUnit> orgUnits)
    {
        if (!departmentId.HasValue || departmentId.Value <= 0) return "";
        var d = depts.FirstOrDefault(x => x.Id == departmentId.Value);
        if (d != null && !string.IsNullOrWhiteSpace(d.Name)) return d.Name.Trim();
        var ou = orgUnits.FirstOrDefault(x => x.Id == departmentId.Value);
        return ou?.Name?.Trim() ?? "";
    }
}

public class SystemFeedbackIdRequest
{
    public int Id { get; set; }
}

public class SystemFeedbackPublishRequest
{
    public int Id { get; set; }
    public bool Publish { get; set; }
}

public class SystemFeedbackSubmitRequest
{
    public string? OverallRating { get; set; }
    public string? EaseOfUse { get; set; }
    public string? Design { get; set; }
    public string? Performance { get; set; }
    public string? TechnicalSupport { get; set; }
    public string? Notes { get; set; }
}
