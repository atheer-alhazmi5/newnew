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
    private readonly UiHelperService _ui;
    public FeedbackController(UiHelperService ui) { _ui = ui; }

    public IActionResult Index()
    {
        var auth = RequireAuth(); if (auth != null) return auth;
        SetViewBagUser(_ui);
        return View();
    }

    [HttpPost]
    public IActionResult Submit([FromBody] FeedbackRequest req)
    {
        if (!IsAuthenticated) return Json(new { success = false });
        // In real system, save to DB. For now just acknowledge.
        return Json(new { success = true, message = "شكراً لتقييمك!" });
    }
}

public class FeedbackRequest { public int Rating { get; set; } public string? Comment { get; set; } }

public class GuideController : BaseController
{
    private readonly UiHelperService _ui;
    public GuideController(UiHelperService ui) { _ui = ui; }

    public IActionResult Index()
    {
        var auth = RequireAuth(); if (auth != null) return auth;
        SetViewBagUser(_ui);
        return View();
    }
}

public class ErrorController : BaseController
{
    public IActionResult Index() => View();
}
