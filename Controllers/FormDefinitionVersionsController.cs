using System.Text.Json;
using FormsSystem.Models.Entities;
using FormsSystem.Services;
using Microsoft.AspNetCore.Mvc;

namespace FormsSystem.Controllers;

/// <summary>إدارة إصدارات النموذج (FormDefinitionVersions): صفحة مستقلة لكل نموذج.</summary>
public class FormDefinitionVersionsController : BaseController
{
    private readonly DataService _ds;
    private readonly UiHelperService _ui;

    public FormDefinitionVersionsController(DataService ds, UiHelperService ui)
    {
        _ds = ds;
        _ui = ui;
    }

    public async Task<IActionResult> Index(int id)
    {
        var auth = RequireAuth();
        if (auth != null) return auth;
        if (CurrentUserRole != "Admin" && CurrentUserRole != "Employee")
            return RedirectToAction("Index", "Inbox");

        var form = await _ds.GetFormDefinitionByIdAsync(id);
        if (form == null) return RedirectToAction("Index", "FormDefinitions");

        // ملء تلقائي إن لم يكن المعرف موجوداً أو لا توجد إصدارات
        var pubBackfilled = false;
        if (string.IsNullOrWhiteSpace(form.PublicId))
        {
            form.PublicId = await _ds.NextFormDefinitionPublicIdAsync();
            await _ds.UpdateFormDefinitionAsync(form);
            pubBackfilled = true;
        }
        var existing = await _ds.ListFormDefinitionVersionsAsync(form.Id);
        if (existing.Count == 0)
        {
            await _ds.AddFormDefinitionVersionAsync(new FormDefinitionVersion
            {
                FormDefinitionId = form.Id,
                VersionNumber = 1,
                VersionName = "V:1.0",
                FieldsJson = form.FieldsJson ?? "[]",
                Status = (form.Status == "approved") ? "approved" : "draft",
                IsActive = true,
                CreatedBy = string.IsNullOrWhiteSpace(form.CreatedBy) ? CurrentUserFullName : form.CreatedBy,
                CreatedAt = form.CreatedAt
            });
        }
        _ = pubBackfilled;

        SetViewBagUser(_ui);
        ViewBag.PageName = "إصدارات نسخ النموذج";
        ViewBag.FormDefinitionId = form.Id;
        ViewBag.FormName = form.Name;
        ViewBag.FormPublicId = form.PublicId ?? "";
        return View();
    }

    [HttpGet]
    public async Task<IActionResult> GetVersions(int formId)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        var form = await _ds.GetFormDefinitionByIdAsync(formId);
        if (form == null) return Json(new { success = false, message = "النموذج غير موجود" });

        var versions = await _ds.ListFormDefinitionVersionsAsync(formId);
        var data = versions
            .OrderBy(v => v.VersionNumber)
            .Select(v =>
            {
                var (fields, sections, rules) = CountFromFieldsJson(v.FieldsJson);
                return new
                {
                    v.Id,
                    v.VersionName,
                    v.VersionNumber,
                    fieldsCount = fields,
                    sectionsCount = sections,
                    rulesCount = rules,
                    v.Status,
                    v.IsActive,
                    v.CreatedBy,
                    CreatedAt = v.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
                    UpdatedBy = v.UpdatedBy ?? "",
                    UpdatedAt = v.UpdatedAt?.ToString("yyyy-MM-dd HH:mm") ?? ""
                };
            })
            .ToList();

        return Json(new
        {
            success = true,
            data,
            form = new
            {
                form.Id,
                publicId = form.PublicId ?? "",
                form.Name
            },
            isAdmin = CurrentUserRole == "Admin"
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetVersion(int id)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        var v = await _ds.GetFormDefinitionVersionByIdAsync(id);
        if (v == null) return Json(new { success = false, message = "غير موجود" });
        var form = await _ds.GetFormDefinitionByIdAsync(v.FormDefinitionId);
        return Json(new
        {
            success = true,
            data = new
            {
                v.Id,
                v.FormDefinitionId,
                v.VersionName,
                v.VersionNumber,
                v.FieldsJson,
                v.Status,
                v.IsActive,
                v.CreatedBy,
                CreatedAt = v.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
                UpdatedBy = v.UpdatedBy ?? "",
                UpdatedAt = v.UpdatedAt?.ToString("yyyy-MM-dd HH:mm") ?? "",
                FormName = form?.Name ?? "",
                FormPublicId = form?.PublicId ?? "",
                TemplateId = form?.TemplateId ?? 0
            }
        });
    }

    /// <summary>تُستخدم عند فتح معالج "إنشاء نسخة إصدار جديدة" لجلب بيانات الإصدار النشط الحالي.</summary>
    [HttpGet]
    public async Task<IActionResult> GetActiveVersionForForm(int formId)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        var v = await _ds.GetActiveFormDefinitionVersionAsync(formId);
        if (v == null)
        {
            // fallback: استخدم محتوى النموذج نفسه
            var f = await _ds.GetFormDefinitionByIdAsync(formId);
            if (f == null) return Json(new { success = false, message = "النموذج غير موجود" });
            return Json(new { success = true, data = new { fieldsJson = f.FieldsJson, formName = f.Name } });
        }
        return Json(new { success = true, data = new { fieldsJson = v.FieldsJson, versionName = v.VersionName } });
    }

    [HttpPost]
    public async Task<IActionResult> AddVersion([FromBody] VersionAddRequest req)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        if (CurrentUserRole != "Admin" && CurrentUserRole != "Employee")
            return Json(new { success = false, message = "غير مصرح" });

        var form = await _ds.GetFormDefinitionByIdAsync(req.FormDefinitionId);
        if (form == null) return Json(new { success = false, message = "النموذج غير موجود" });

        var nextNum = await _ds.NextFormDefinitionVersionNumberAsync(form.Id);
        var isAdmin = CurrentUserRole == "Admin";
        var willActivate = req.SendForApproval && isAdmin;

        var v = new FormDefinitionVersion
        {
            FormDefinitionId = form.Id,
            VersionNumber = nextNum,
            VersionName = $"V:{nextNum}.0",
            FieldsJson = string.IsNullOrWhiteSpace(req.FieldsJson) ? "[]" : req.FieldsJson,
            Status = willActivate ? "approved" : "draft",
            IsActive = willActivate,
            CreatedBy = CurrentUserFullName
        };
        var created = await _ds.AddFormDefinitionVersionAsync(v);

        // إذا أصبح هذا الإصدار نشطاً، نُحدّث محتوى النموذج نفسه ليطابق المحتوى الجديد
        if (created.IsActive)
        {
            form.FieldsJson = created.FieldsJson;
            form.UpdatedBy = CurrentUserFullName;
            form.UpdatedAt = DateTime.Now;
            await _ds.UpdateFormDefinitionAsync(form);
        }

        await _ds.AddAuditLogAsync(BuildAuditEntry("إنشاء إصدار", "FormDefinitionVersion", created.Id.ToString(), $"{form.Name} – {created.VersionName}"));
        return Json(new { success = true, id = created.Id, versionName = created.VersionName });
    }

    [HttpPost]
    public async Task<IActionResult> UpdateVersion([FromBody] VersionUpdateRequest req)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        var v = await _ds.GetFormDefinitionVersionByIdAsync(req.Id);
        if (v == null) return Json(new { success = false, message = "غير موجود" });
        if (v.Status == "approved")
            return Json(new { success = false, message = "لا يمكن تعديل إصدار معتمد" });

        var isAdmin = CurrentUserRole == "Admin";
        v.FieldsJson = string.IsNullOrWhiteSpace(req.FieldsJson) ? v.FieldsJson : req.FieldsJson;
        v.UpdatedBy = CurrentUserFullName;
        v.UpdatedAt = DateTime.Now;

        // عند الاعتماد: نشر الإصدار وتفعيله، وإلغاء تفعيل الباقي
        if (req.SendForApproval && isAdmin)
        {
            v.Status = "approved";
            v.IsActive = true;
        }

        await _ds.UpdateFormDefinitionVersionAsync(v);

        if (v.IsActive)
        {
            var form = await _ds.GetFormDefinitionByIdAsync(v.FormDefinitionId);
            if (form != null)
            {
                form.FieldsJson = v.FieldsJson;
                form.UpdatedBy = CurrentUserFullName;
                form.UpdatedAt = DateTime.Now;
                await _ds.UpdateFormDefinitionAsync(form);
            }
        }
        await _ds.AddAuditLogAsync(BuildAuditEntry("تعديل إصدار", "FormDefinitionVersion", v.Id.ToString(), v.VersionName));
        return Json(new { success = true });
    }

    [HttpPost]
    public async Task<IActionResult> DeleteVersion([FromBody] VersionIdRequest req)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        var v = await _ds.GetFormDefinitionVersionByIdAsync(req.Id);
        if (v == null) return Json(new { success = false, message = "غير موجود" });
        if (v.Status == "approved")
            return Json(new { success = false, message = "لا يمكن حذف إصدار معتمد" });

        await _ds.DeleteFormDefinitionVersionAsync(req.Id);
        await _ds.AddAuditLogAsync(BuildAuditEntry("حذف إصدار", "FormDefinitionVersion", v.Id.ToString(), v.VersionName));
        return Json(new { success = true });
    }

    private static (int fields, int sections, int rules) CountFromFieldsJson(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return (0, 0, 0);
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.ValueKind == JsonValueKind.Array)
                return (root.GetArrayLength(), 0, 0);
            if (root.ValueKind == JsonValueKind.Object)
            {
                int fc = 0, sc = 0, rc = 0;
                if (root.TryGetProperty("fields", out var f) && f.ValueKind == JsonValueKind.Array) fc = f.GetArrayLength();
                if (root.TryGetProperty("sections", out var s) && s.ValueKind == JsonValueKind.Array) sc = s.GetArrayLength();
                if (root.TryGetProperty("rules", out var r) && r.ValueKind == JsonValueKind.Array) rc = r.GetArrayLength();
                return (fc, sc, rc);
            }
        }
        catch { }
        return (0, 0, 0);
    }

    public class VersionAddRequest
    {
        public int FormDefinitionId { get; set; }
        public string? FieldsJson { get; set; }
        public bool SendForApproval { get; set; }
    }

    public class VersionUpdateRequest
    {
        public int Id { get; set; }
        public string? FieldsJson { get; set; }
        public bool SendForApproval { get; set; }
    }

    public class VersionIdRequest { public int Id { get; set; } }
}
