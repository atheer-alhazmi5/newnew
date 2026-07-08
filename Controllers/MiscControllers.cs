using FormsSystem.Services;
using Microsoft.AspNetCore.Mvc;

namespace FormsSystem.Controllers;

public class ReportsController : BaseController
{
    private readonly DataService _ds;
    private readonly PdfService _pdf;
    private readonly ExcelService _excel;
    private readonly UiHelperService _ui;

    public ReportsController(DataService ds, PdfService pdf, ExcelService excel, UiHelperService ui)
    { _ds = ds; _pdf = pdf; _excel = excel; _ui = ui; }

    [HttpGet]
    public async Task<IActionResult> ExportFormsPdf()
    {
        if (!IsAuthenticated) return RedirectToAction("Login", "Account");
        var forms = await _ds.ListAllFormsAsync();
        var rows = forms.Select(f => new Dictionary<string, string>
        {
            ["اسم النموذج"] = f.Name,
            ["النوع"] = f.Type,
            ["الفئة"] = f.Category,
            ["المنشئ"] = f.CreatedBy,
            ["التاريخ"] = _ui.FormatDate(f.CreatedAt)
        }).ToList();
        var bytes = _pdf.GenerateFormReport("تقرير النماذج",
            rows, ["اسم النموذج", "النوع", "الفئة", "المنشئ", "التاريخ"]);
        return File(bytes, "application/pdf", "forms-report.pdf");
    }

    [HttpGet]
    public async Task<IActionResult> ExportFormsExcel()
    {
        if (!IsAuthenticated) return RedirectToAction("Login", "Account");
        var forms = await _ds.ListAllFormsAsync();
        var headers = new List<string> { "اسم النموذج", "النوع", "الفئة", "المنشئ", "تاريخ الإنشاء" };
        var rows = forms.Select(f => new List<string>
        {
            f.Name, f.Type, f.Category, f.CreatedBy, _ui.FormatDate(f.CreatedAt)
        }).ToList();
        var bytes = _excel.GenerateExcel("النماذج", headers, rows);
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "forms.xlsx");
    }

    [HttpGet]
    public async Task<IActionResult> ExportUsersExcel()
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin") return Forbid();
        var users = await _ds.ListUsersAsync();
        var headers = new List<string> { "الاسم", "المستخدم", "الدور", "القسم", "الحالة" };
        var rows = users.Select(u => new List<string>
        {
            u.FullName, u.Username, u.RoleLabel, u.Department?.Name ?? "", u.Status.ToString()
        }).ToList();
        var bytes = _excel.GenerateExcel("المستخدمون", headers, rows);
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "users.xlsx");
    }
}

public class FeedbackController : BaseController
{
    public IActionResult Index()
    {
        var auth = RequireAuth();
        if (auth != null) return auth;
        return RedirectToAction("Index", "SystemEvaluation");
    }
}

public class FeedbackRequest { public int Rating { get; set; } public string? Comment { get; set; } }

public class GuideController : BaseController
{
    private readonly DataService _ds;
    private readonly UiHelperService _ui;

    public GuideController(DataService ds, UiHelperService ui)
    {
        _ds = ds;
        _ui = ui;
    }

    public IActionResult Index()
    {
        var auth = RequireAuth();
        if (auth != null) return auth;
        ViewBag.UserId = CurrentUserId;
        ViewBag.Title = "دليل المستخدم";
        return View();
    }

    /// <summary>محتوى الدليل للقراءة — عناصر مفعّلة فقط، لجميع المستخدمين المصادقين.</summary>
    [HttpGet]
    public async Task<IActionResult> GetReaderItems()
    {
        if (!IsAuthenticated)
            return Json(new { success = false, message = "غير مصرح" });

        var all = await _ds.ListUserGuideItemsAsync();
        if (all.Any(x => string.IsNullOrWhiteSpace(x.OrderPath)))
            await _ds.RecalculateUserGuideHierarchyAsync();
        all = await _ds.ListUserGuideItemsAsync();

        var active = all.Where(x => x.IsActive).ToList();
        var childCounts = active
            .Where(x => x.ParentId.HasValue)
            .GroupBy(x => x.ParentId!.Value)
            .ToDictionary(g => g.Key, g => g.Count());

        var data = active
            .Select(r => new
            {
                r.Id,
                r.ParentId,
                r.Name,
                r.Content,
                r.AttachmentUrl,
                Icon = string.IsNullOrWhiteSpace(r.Icon) ? "bi-journal-text" : r.Icon.Trim(),
                Color = string.IsNullOrWhiteSpace(r.Color) ? "#25935F" : r.Color.Trim(),
                r.Notes,
                r.OrderPath,
                DisplayOrder = FormatGuideDisplayOrder(r.OrderPath),
                HasChildren = childCounts.ContainsKey(r.Id)
            })
            .OrderBy(x => x.OrderPath, StringComparer.Create(new System.Globalization.CultureInfo("ar-SA"), false))
            .ToList();

        return Json(new { success = true, data });
    }

    private static string FormatGuideDisplayOrder(string? orderPath)
    {
        if (string.IsNullOrWhiteSpace(orderPath)) return "";
        var parts = orderPath.Split('،', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length == 0) return "";
        if (parts.Length == 1) return parts[0];
        if (parts.Length == 2) return parts[0] + "،" + parts[1];
        return parts[0] + "،" + parts[1] + "-" + string.Join("-", parts.Skip(2));
    }
}

public class ErrorController : BaseController
{
    public IActionResult Index() => View();
}
