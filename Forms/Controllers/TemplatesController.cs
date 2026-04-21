using System.Globalization;
using FormsSystem.Models.Entities;
using FormsSystem.Services;
using Microsoft.AspNetCore.Mvc;

namespace FormsSystem.Controllers;

public class TemplatesController : BaseController
{
    private readonly DataService _ds;
    private readonly UiHelperService _ui;

    public TemplatesController(DataService ds, UiHelperService ui)
    {
        _ds = ds;
        _ui = ui;
    }

    public IActionResult Index()
    {
        var auth = RequireAuth();
        if (auth != null) return auth;
        if (CurrentUserRole != "Admin")
            return RedirectToAction("Index", "Forms");
        SetViewBagUser(_ui);
        ViewBag.PageName = "إدارة القوالب";
        return View();
    }

    [HttpGet]
    public async Task<IActionResult> GetTemplates(string? search, string? isActive)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var list = await _ds.ListFormTemplatesAsync();

        if (!string.IsNullOrWhiteSpace(search))
            list = list.Where(t => t.Name.Contains(search, StringComparison.OrdinalIgnoreCase)).ToList();

        if (!string.IsNullOrWhiteSpace(isActive))
        {
            bool active = isActive == "true";
            list = list.Where(t => t.IsActive == active).ToList();
        }

        return Json(new
        {
            success = true,
            data = list.Select(t => new
            {
                t.Id, t.Name, t.Description, t.Color, t.IsActive,
                t.HeaderSections, t.FooterSections,
                t.HeaderJson, t.FooterJson,
                t.MarginTop, t.MarginBottom, t.MarginRight, t.MarginLeft,
                t.PageDirection, t.PageSize,
                t.ShowHeaderLine, t.ShowFooterLine,
                t.CreatedBy, t.CreatedAt
            })
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetTemplate(int id)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var t = await _ds.GetFormTemplateByIdAsync(id);
        if (t == null) return Json(new { success = false, message = "القالب غير موجود" });

        var beneficiaries = await _ds.ListBeneficiariesAsync();
        var createdByDisplay = ResolveBeneficiaryDisplayName(t.CreatedBy, beneficiaries);
        var updatedByDisplay = ResolveBeneficiaryDisplayName(t.UpdatedBy, beneficiaries);
        var logs = await _ds.ListAllAuditLogsAsync();
        var deleteLog = logs
            .Where(l => string.Equals(l.EntityType, "FormTemplate", StringComparison.Ordinal)
                && string.Equals(l.EntityId, id.ToString(CultureInfo.InvariantCulture), StringComparison.Ordinal)
                && string.Equals(l.Action, "حذف قالب", StringComparison.Ordinal))
            .OrderByDescending(l => l.CreatedAt)
            .FirstOrDefault();
        var deletedAtDisplay = deleteLog != null
            ? deleteLog.CreatedAt.ToLocalTime().ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture)
            : "";

        return Json(new
        {
            success = true,
            data = new
            {
                t.Id, t.Name, t.Description, t.Color, t.IsActive,
                t.HeaderSections, t.FooterSections,
                t.HeaderJson, t.FooterJson,
                t.MarginTop, t.MarginBottom, t.MarginRight, t.MarginLeft,
                t.PageDirection, t.PageSize,
                t.ShowHeaderLine, t.ShowFooterLine,
                t.CreatedBy, t.CreatedAt, t.UpdatedBy, t.UpdatedAt,
                CreatedAtDisplay = t.CreatedAt.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture),
                UpdatedAtDisplay = t.UpdatedAt.HasValue
                    ? t.UpdatedAt.Value.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture)
                    : "",
                CreatedByDisplay = createdByDisplay,
                UpdatedByDisplay = updatedByDisplay,
                DeletedAtDisplay = deletedAtDisplay
            }
        });
    }

    [HttpPost]
    public async Task<IActionResult> AddTemplate([FromBody] TemplateRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        if (string.IsNullOrWhiteSpace(req.Name))
            return Json(new { success = false, message = "اسم القالب مطلوب" });

        var t = new FormTemplate
        {
            Name = req.Name.Trim(),
            Description = req.Description?.Trim() ?? "",
            Color = req.Color ?? "#25935F",
            IsActive = req.IsActive ?? true,
            HeaderSections = req.HeaderSections ?? 1,
            FooterSections = req.FooterSections ?? 1,
            HeaderJson = req.HeaderJson ?? "[]",
            FooterJson = req.FooterJson ?? "[]",
            MarginTop = req.MarginTop ?? 20,
            MarginBottom = req.MarginBottom ?? 20,
            MarginRight = req.MarginRight ?? 20,
            MarginLeft = req.MarginLeft ?? 20,
            PageDirection = req.PageDirection ?? "RTL",
            PageSize = req.PageSize ?? "A4",
            ShowHeaderLine = req.ShowHeaderLine ?? true,
            ShowFooterLine = req.ShowFooterLine ?? true,
            CreatedBy = CurrentUserFullName ?? CurrentUserName ?? ""
        };

        await _ds.AddFormTemplateAsync(t);
        return Json(new { success = true, message = "تم إنشاء القالب بنجاح", data = new { t.Id } });
    }

    [HttpPost]
    public async Task<IActionResult> UpdateTemplate([FromBody] TemplateUpdateRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        if (req.Id <= 0) return Json(new { success = false, message = "معرف غير صالح" });

        var t = await _ds.GetFormTemplateByIdAsync(req.Id);
        if (t == null) return Json(new { success = false, message = "القالب غير موجود" });

        if (!string.IsNullOrWhiteSpace(req.Name)) t.Name = req.Name.Trim();
        if (req.Description != null) t.Description = req.Description.Trim();
        if (req.Color != null) t.Color = req.Color;
        if (req.IsActive.HasValue) t.IsActive = req.IsActive.Value;
        if (req.HeaderSections.HasValue) t.HeaderSections = req.HeaderSections.Value;
        if (req.FooterSections.HasValue) t.FooterSections = req.FooterSections.Value;
        if (req.HeaderJson != null) t.HeaderJson = req.HeaderJson;
        if (req.FooterJson != null) t.FooterJson = req.FooterJson;
        if (req.MarginTop.HasValue) t.MarginTop = req.MarginTop.Value;
        if (req.MarginBottom.HasValue) t.MarginBottom = req.MarginBottom.Value;
        if (req.MarginRight.HasValue) t.MarginRight = req.MarginRight.Value;
        if (req.MarginLeft.HasValue) t.MarginLeft = req.MarginLeft.Value;
        if (req.PageDirection != null) t.PageDirection = req.PageDirection;
        if (req.PageSize != null) t.PageSize = req.PageSize;
        if (req.ShowHeaderLine.HasValue) t.ShowHeaderLine = req.ShowHeaderLine.Value;
        if (req.ShowFooterLine.HasValue) t.ShowFooterLine = req.ShowFooterLine.Value;

        t.UpdatedBy = CurrentUserFullName ?? CurrentUserName ?? "";
        t.UpdatedAt = DateTime.Now;

        await _ds.UpdateFormTemplateAsync(t);
        return Json(new { success = true, message = "تم تحديث القالب بنجاح" });
    }

    [HttpPost]
    public async Task<IActionResult> DeleteTemplate([FromBody] TemplateIdRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var tpl = await _ds.GetFormTemplateByIdAsync(req.Id);
        if (tpl == null)
            return Json(new { success = false, message = "القالب غير موجود" });

        await _ds.AddAuditLogAsync(BuildAuditEntry("حذف قالب", "FormTemplate", req.Id.ToString(CultureInfo.InvariantCulture), tpl.Name));

        var ok = await _ds.DeleteFormTemplateAsync(req.Id);
        return Json(ok
            ? new { success = true, message = "تم حذف القالب بنجاح" }
            : new { success = false, message = "القالب غير موجود" });
    }

    [HttpPost]
    public async Task<IActionResult> ToggleTemplate([FromBody] TemplateIdRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var t = await _ds.GetFormTemplateByIdAsync(req.Id);
        if (t == null) return Json(new { success = false, message = "القالب غير موجود" });

        t.IsActive = !t.IsActive;
        t.UpdatedBy = CurrentUserFullName ?? CurrentUserName ?? "";
        t.UpdatedAt = DateTime.Now;
        await _ds.UpdateFormTemplateAsync(t);

        return Json(new { success = true, isActive = t.IsActive });
    }

    [HttpPost]
    public async Task<IActionResult> UploadTemplateImage(IFormFile file)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        if (file == null || file.Length == 0)
            return Json(new { success = false, message = "لم يتم اختيار ملف" });

        var allowed = new[] { "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml" };
        if (!allowed.Contains(file.ContentType.ToLower()))
            return Json(new { success = false, message = "نوع الملف غير مدعوم (صور فقط)" });

        if (file.Length > 5_000_000)
            return Json(new { success = false, message = "حجم الملف يتجاوز 5 MB" });

        var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "templates");
        Directory.CreateDirectory(uploadsDir);
        var ext = Path.GetExtension(file.FileName);
        var fileName = $"{Guid.NewGuid()}{ext}";
        var filePath = Path.Combine(uploadsDir, fileName);
        using (var stream = System.IO.File.Create(filePath))
            await file.CopyToAsync(stream);

        return Json(new { success = true, url = $"/uploads/templates/{fileName}" });
    }

    // ── DTOs ──────────────────────────────────────────────────────────────
    public class TemplateRequest
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
        public string? Color { get; set; }
        public bool? IsActive { get; set; }
        public int? HeaderSections { get; set; }
        public int? FooterSections { get; set; }
        public string? HeaderJson { get; set; }
        public string? FooterJson { get; set; }
        public int? MarginTop { get; set; }
        public int? MarginBottom { get; set; }
        public int? MarginRight { get; set; }
        public int? MarginLeft { get; set; }
        public string? PageDirection { get; set; }
        public string? PageSize { get; set; }
        public bool? ShowHeaderLine { get; set; }
        public bool? ShowFooterLine { get; set; }
    }

    public class TemplateUpdateRequest : TemplateRequest
    {
        public int Id { get; set; }
    }

    public class TemplateIdRequest
    {
        public int Id { get; set; }
    }

    private static string ResolveBeneficiaryDisplayName(string? stored, List<Beneficiary> beneficiaries)
    {
        var s = (stored ?? "").Trim();
        if (string.IsNullOrEmpty(s)) return "";
        var b = beneficiaries.FirstOrDefault(x => string.Equals((x.FullName ?? "").Trim(), s, StringComparison.Ordinal));
        if (b != null) return (b.FullName ?? "").Trim();
        b = beneficiaries.FirstOrDefault(x => string.Equals((x.Username ?? "").Trim(), s, StringComparison.OrdinalIgnoreCase));
        if (b != null) return (b.FullName ?? "").Trim();
        return s;
    }
}
