using System.IO.Compression;
using System.Linq;
using FormsSystem.Models.Entities;
using FormsSystem.Models.Enums;
using FormsSystem.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;

namespace FormsSystem.Controllers;

public class SettingsController : BaseController
{
    private readonly DataService _ds;
    private readonly UiHelperService _ui;
    private readonly PasswordService _pw;
    private readonly ExcelService _excel;
    private readonly PdfService _pdf;

    public SettingsController(DataService ds, UiHelperService ui, PasswordService pw, ExcelService excel, PdfService pdf)
    { _ds = ds; _ui = ui; _pw = pw; _excel = excel; _pdf = pdf; }

    // ───  (سجل العمليات) ─────────────────────────────────────────────

    public IActionResult AuditLog()
    {
        var auth = RequireAuth(); if (auth != null) return auth;
        if (CurrentUserRole != "Admin")
            return RedirectToAction("Index", "Forms");
        SetViewBagUser(_ui);
        ViewBag.PageName = "سجل العمليات";
        return View();
    }

    [HttpGet]
    public async Task<IActionResult> GetAuditLogs()
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var logs = await _ds.ListAllAuditLogsAsync();
        var beneficiaries = await _ds.ListBeneficiariesAsync();
        var orgUnits = await _ds.ListOrganizationalUnitsAsync();

        return Json(new
        {
            success = true,
            data = logs.Select((l, idx) => new
            {
                l.Id,
                l.UserId,
                l.UserName,
                l.NationalId,
                l.OrganizationalUnit,
                l.Action,
                l.EntityType,
                l.EntityId,
                l.Details,
                l.IpAddress,
                l.Browser,
                l.OperatingSystem,
                CreatedAt = l.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss")
            }),
            organizationalUnits = orgUnits.Where(u => u.IsActive).OrderBy(u => u.SortOrder)
                .Select(u => new { u.Id, u.Name }).ToList(),
            beneficiaries = beneficiaries.Where(b => b.IsActive)
                .Select(b => new { b.Id, b.FullName, b.NationalId }).ToList()
        });
    }

    [HttpGet]
    public async Task<IActionResult> ExportAuditLogsPdf()
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Unauthorized();

        var logs = await _ds.ListAllAuditLogsAsync();
        var columns = new List<string> { "#", "رقم الهوية", "اسم المستفيد", "الوحدة التنظيمية", "العملية", "التاريخ والوقت", "المتصفح", "عنوان IP", "نظام التشغيل" };
        var rows = logs.Select((l, i) => new Dictionary<string, string>
        {
            ["#"] = (i + 1).ToString(),
            ["رقم الهوية"] = l.NationalId,
            ["اسم المستفيد"] = l.UserName,
            ["الوحدة التنظيمية"] = l.OrganizationalUnit,
            ["العملية"] = l.Action,
            ["التاريخ والوقت"] = l.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
            ["المتصفح"] = l.Browser,
            ["عنوان IP"] = l.IpAddress,
            ["نظام التشغيل"] = l.OperatingSystem
        }).ToList();

        var bytes = _pdf.GenerateFormReport("سجل العمليات", rows, columns);
        return File(bytes, "text/html; charset=utf-8", $"سجل_العمليات_{DateTime.Now:yyyyMMdd}.html");
    }

    [HttpGet]
    public async Task<IActionResult> ExportAuditLogsExcel()
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Unauthorized();

        var logs = await _ds.ListAllAuditLogsAsync();
        var headers = new List<string> { "#", "رقم الهوية", "اسم المستفيد", "الوحدة التنظيمية", "العملية", "التاريخ والوقت", "المتصفح", "عنوان IP", "نظام التشغيل" };
        var rows = logs.Select((l, i) => new List<string>
        {
            (i + 1).ToString(),
            l.NationalId,
            l.UserName,
            l.OrganizationalUnit,
            l.Action,
            l.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
            l.Browser,
            l.IpAddress,
            l.OperatingSystem
        }).ToList();

        var bytes = _excel.GenerateExcel("سجل العمليات", headers, rows);
        return File(bytes, "text/csv; charset=utf-8", $"سجل_العمليات_{DateTime.Now:yyyyMMdd}.csv");
    }

    // ─── النسخ الاحتياطي ─────────────────────────────────────────────────────

    public IActionResult Backup()
    {
        var auth = RequireAuth(); if (auth != null) return auth;
        if (CurrentUserRole != "Admin")
            return RedirectToAction("Index", "Forms");
        return View();
    }

    [HttpGet]
    public async Task<IActionResult> GetBackupRecords()
    {
        var auth = RequireAuth(); if (auth != null) return Unauthorized();
        var records = await _ds.ListBackupRecordsAsync();
        return Json(records.Select(b => new
        {
            b.Id,
            b.Name,
            b.BackupType,
            b.SizeBytes,
            SizeDisplay = b.SizeDisplay,
            CreatedAt = b.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
            HasFile = !string.IsNullOrEmpty(b.FilePath) && System.IO.File.Exists(b.FilePath)
        }));
    }

    [HttpPost]
    public async Task<IActionResult> CreateBackup([FromBody] CreateBackupRequest req)
    {
        var auth = RequireAuth(); if (auth != null) return Unauthorized();
        if (string.IsNullOrWhiteSpace(req.Name))
            return Json(new { success = false, message = "اسم النسخة مطلوب" });
        if (string.IsNullOrWhiteSpace(req.BackupType))
            return Json(new { success = false, message = "نوع النسخة مطلوب" });

        try
        {
            // Build backups folder next to the data folder
            var dataDir    = _ds.GetDataDirectory();
            var backupsDir = Path.Combine(Path.GetDirectoryName(dataDir)!, "backups");
            Directory.CreateDirectory(backupsDir);

            var stamp      = DateTime.Now.ToString("yyyyMMdd_HHmmss");
            var safeName   = string.Concat(req.Name.Trim().Take(40)).Replace(" ", "_");
            var zipName    = $"{safeName}_{stamp}.zip";
            var zipPath    = Path.Combine(backupsDir, zipName);

            // Zip all JSON data files (except the backup_records list itself)
            var jsonFiles = Directory.GetFiles(dataDir, "*.json")
                .Where(f => !Path.GetFileName(f).Equals("backup_records.json",
                                StringComparison.OrdinalIgnoreCase))
                .ToArray();

            using (var zip = ZipFile.Open(zipPath, ZipArchiveMode.Create))
            {
                foreach (var file in jsonFiles)
                    zip.CreateEntryFromFile(file, Path.GetFileName(file),
                        CompressionLevel.SmallestSize);
            }

            var fileInfo = new FileInfo(zipPath);
            var rec = new BackupRecord
            {
                Name       = req.Name.Trim(),
                BackupType = req.BackupType,
                SizeBytes  = fileInfo.Length,
                FilePath   = zipPath,
                CreatedBy  = CurrentUserFullName ?? CurrentUserName ?? ""
            };

            await _ds.AddBackupRecordAsync(rec);
            await _ds.AddAuditLogAsync(BuildAuditEntry(
                $"إنشاء نسخة احتياطية: {rec.Name} ({rec.BackupType})",
                "نسخ احتياطي", rec.Id.ToString()));

            return Json(new { success = true });
        }
        catch (Exception ex)
        {
            return Json(new { success = false, message = $"فشل إنشاء النسخة: {ex.Message}" });
        }
    }

    [HttpGet]
    public async Task<IActionResult> DownloadBackup(int id)
    {
        var auth = RequireAuth(); if (auth != null) return Unauthorized();
        var records = await _ds.ListBackupRecordsAsync();
        var rec = records.FirstOrDefault(b => b.Id == id);
        if (rec == null || string.IsNullOrEmpty(rec.FilePath) || !System.IO.File.Exists(rec.FilePath))
            return NotFound("ملف النسخة الاحتياطية غير موجود");

        var bytes    = await System.IO.File.ReadAllBytesAsync(rec.FilePath);
        var fileName = Path.GetFileName(rec.FilePath);
        return File(bytes, "application/zip", fileName);
    }

    [HttpPost]
    public async Task<IActionResult> RestoreBackup(int id)
    {
        var auth = RequireAuth(); if (auth != null) return Unauthorized();
        var records = await _ds.ListBackupRecordsAsync();
        var rec = records.FirstOrDefault(b => b.Id == id);
        if (rec == null || string.IsNullOrEmpty(rec.FilePath) || !System.IO.File.Exists(rec.FilePath))
            return Json(new { success = false, message = "ملف النسخة الاحتياطية غير موجود" });

        try
        {
            var dataDir = _ds.GetDataDirectory();
            using var zip = ZipFile.OpenRead(rec.FilePath);
            foreach (var entry in zip.Entries)
            {
                if (!entry.Name.EndsWith(".json", StringComparison.OrdinalIgnoreCase)) continue;
                var dest = Path.Combine(dataDir, entry.Name);
                entry.ExtractToFile(dest, overwrite: true);
            }

            await _ds.AddAuditLogAsync(BuildAuditEntry(
                $"استعادة نسخة احتياطية: {rec.Name} ({rec.BackupType})",
                "نسخ احتياطي", rec.Id.ToString()));

            return Json(new { success = true });
        }
        catch (Exception ex)
        {
            return Json(new { success = false, message = $"فشل الاستعادة: {ex.Message}" });
        }
    }

    [HttpPost]
    public async Task<IActionResult> DeleteBackup(int id)
    {
        var auth = RequireAuth(); if (auth != null) return Unauthorized();

        // Also remove the physical zip file
        var records = await _ds.ListBackupRecordsAsync();
        var rec     = records.FirstOrDefault(b => b.Id == id);
        if (rec != null && !string.IsNullOrEmpty(rec.FilePath) && System.IO.File.Exists(rec.FilePath))
        {
            try { System.IO.File.Delete(rec.FilePath); } catch { /* ignore */ }
        }

        var deleted = await _ds.DeleteBackupRecordAsync(id);
        if (deleted)
        {
            await _ds.AddAuditLogAsync(BuildAuditEntry(
                $"حذف نسخة احتياطية: {rec?.Name ?? id.ToString()}",
                "نسخ احتياطي", id.ToString()));
        }
        return Json(new { success = deleted });
    }

    public class CreateBackupRequest
    {
        public string Name { get; set; } = "";
        public string BackupType { get; set; } = "";
    }

    // ─── الإشعارات  ───────────────────────────────────────────────────

    public IActionResult PopupNotifications()
    {
        var auth = RequireAuth(); if (auth != null) return auth;
        if (CurrentUserRole != "Admin") return RedirectToAction("Index", "Forms");
        SetViewBagUser(_ui);
        ViewBag.PageName = "الإشعارات المنبثقة";
        return View();
    }

    [HttpGet]
    public async Task<IActionResult> GetPopupNotifications()
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin") return Unauthorized();
        var list  = await _ds.ListPopupNotificationsAsync();
        var users = await _ds.ListUsersAsync();
        var depts = await _ds.ListOrganizationalUnitsAsync();
        return Json(list.Select(p => new
        {
            p.Id, p.Title, p.TitleColor, p.TitleFontSize,
            p.Category, p.ContentType,
            p.TextContent, p.AttachmentUrl, p.AttachmentMime, p.ExternalUrl,
            p.DisplayPeriod,
            StartDate   = p.StartDate?.ToString("yyyy-MM-dd"),
            EndDate     = p.EndDate?.ToString("yyyy-MM-dd"),
            p.TargetUserIds, p.TargetDepartmentIds,
            p.DisplayLocation, p.Status,
            p.CreatedBy,
            CreatedAt   = p.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
            PublishedAt = p.PublishedAt?.ToString("yyyy-MM-dd HH:mm"),
            TargetUserNames = p.TargetUserIds.Any()
                ? users.Where(u => p.TargetUserIds.Contains(u.Id)).Select(u => u.FullName).ToList()
                : new List<string> { "جميع الموظفين" },
            TargetDeptNames = p.TargetDepartmentIds.Any()
                ? depts.Where(d => p.TargetDepartmentIds.Contains(d.Id)).Select(d => d.Name).ToList()
                : new List<string> { "جميع الوحدات" }
        }));
    }

    [HttpGet]
    public async Task<IActionResult> GetPopupNotification(int id)
    {
        if (!IsAuthenticated) return Unauthorized();
        var p = await _ds.GetPopupNotificationAsync(id);
        if (p == null) return NotFound();
        return Json(p);
    }

    [HttpPost]
    public async Task<IActionResult> SavePopupNotification([FromBody] PopupNotification req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin") return Unauthorized();
        if (string.IsNullOrWhiteSpace(req.Title))
            return Json(new { success = false, message = "العنوان مطلوب" });
        if (string.IsNullOrWhiteSpace(req.Category))
            return Json(new { success = false, message = "التصنيف مطلوب" });
        if (string.IsNullOrWhiteSpace(req.ContentType))
            return Json(new { success = false, message = "نوع المحتوى مطلوب" });

        req.CreatedBy = CurrentUserFullName ?? CurrentUserName ?? "";

        if (req.Id == 0)
        {
            var added = await _ds.AddPopupNotificationAsync(req);
            await _ds.AddAuditLogAsync(BuildAuditEntry(
                $"إضافة إشعار منبثق: {req.Title}", "إشعارات", added.Id.ToString()));
            return Json(new { success = true, id = added.Id });
        }
        else
        {
            var existing = await _ds.GetPopupNotificationAsync(req.Id);
            if (existing == null) return Json(new { success = false, message = "الإشعار غير موجود" });
            req.CreatedAt   = existing.CreatedAt;
            req.PublishedAt = existing.PublishedAt;
            req.DismissedByUserIds = existing.DismissedByUserIds;
            await _ds.UpdatePopupNotificationAsync(req);
            await _ds.AddAuditLogAsync(BuildAuditEntry(
                $"تعديل إشعار منبثق: {req.Title}", "إشعارات", req.Id.ToString()));
            return Json(new { success = true });
        }
    }

    [HttpPost]
    public async Task<IActionResult> PublishPopup(int id, [FromBody] PublishPopupRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin") return Unauthorized();
        var p = await _ds.GetPopupNotificationAsync(id);
        if (p == null) return Json(new { success = false, message = "الإشعار غير موجود" });
        p.Status      = req.Publish ? "published" : "draft";
        p.PublishedAt = req.Publish ? DateTime.Now : null;
        await _ds.UpdatePopupNotificationAsync(p);
        await _ds.AddAuditLogAsync(BuildAuditEntry(
            $"{(req.Publish ? "نشر" : "إلغاء نشر")} إشعار: {p.Title}", "إشعارات", id.ToString()));
        return Json(new { success = true });
    }

    [HttpPost]
    public async Task<IActionResult> DeletePopupNotification(int id)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin") return Unauthorized();
        var p = await _ds.GetPopupNotificationAsync(id);
        if (p != null && !string.IsNullOrEmpty(p.AttachmentUrl))
        {
            var physPath = Path.Combine(
                Directory.GetCurrentDirectory(), "wwwroot",
                p.AttachmentUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
            if (System.IO.File.Exists(physPath)) try { System.IO.File.Delete(physPath); } catch { }
        }
        await _ds.DeletePopupNotificationAsync(id);
        await _ds.AddAuditLogAsync(BuildAuditEntry(
            $"حذف إشعار منبثق رقم {id}", "إشعارات", id.ToString()));
        return Json(new { success = true });
    }

    [HttpPost]
    public async Task<IActionResult> UploadPopupAttachment(IFormFile file)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin") return Unauthorized();
        if (file == null || file.Length == 0)
            return Json(new { success = false, message = "لم يتم اختيار ملف" });

        var allowed = new[] { "image/jpeg","image/png","image/gif","image/webp","video/mp4","video/webm" };
        if (!allowed.Contains(file.ContentType.ToLower()))
            return Json(new { success = false, message = "نوع الملف غير مدعوم (صور أو فيديو فقط)" });
        if (file.Length > 20_000_000)
            return Json(new { success = false, message = "حجم الملف يتجاوز 20 MB" });

        var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "popups");
        Directory.CreateDirectory(uploadsDir);
        var ext      = Path.GetExtension(file.FileName);
        var fileName = $"{Guid.NewGuid()}{ext}";
        var filePath = Path.Combine(uploadsDir, fileName);
        using (var stream = System.IO.File.Create(filePath))
            await file.CopyToAsync(stream);

        var mime = file.ContentType.StartsWith("video") ? "video" : "image";
        return Json(new { success = true, url = $"/uploads/popups/{fileName}", mime });
    }

    [HttpGet]
    public async Task<IActionResult> GetActivePopups(string location)
    {
        var loc = (location ?? "").Trim();
        // صفحة اللاندنق
        if (!IsAuthenticated)
        {
            if (!string.Equals(loc, "landing", StringComparison.OrdinalIgnoreCase))
                return Json(new List<object>());
        }

        var userId = IsAuthenticated ? CurrentUserId : 0;
        var deptId = IsAuthenticated ? CurrentDeptId : 0;
        var popups = await _ds.GetActivePopupsForUserAsync(userId, deptId, loc);
        return Json(popups.Select(p => new
        {
            p.Id, p.Title, p.TitleColor, p.TitleFontSize,
            p.Category, p.ContentType,
            p.TextContent, p.AttachmentUrl, p.AttachmentMime, p.ExternalUrl,
            p.DisplayPeriod
        }));
    }

    [HttpPost]
    public async Task<IActionResult> DismissPopup(int id)
    {
        if (!IsAuthenticated)
            return Json(new { success = true }); // 
        await _ds.DismissPopupAsync(id, CurrentUserId);
        return Json(new { success = true });
    }

    public class PublishPopupRequest { public bool Publish { get; set; } }

    [HttpGet]
    public async Task<IActionResult> GetUsersForPopup()
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin") return Unauthorized();
        var users = await _ds.ListUsersAsync();
        return Json(users.Select(u => new { u.Id, FullName = u.FullName }));
    }

    [HttpGet]
    public async Task<IActionResult> GetDeptsForPopup()
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin") return Unauthorized();
        var units = await _ds.ListOrganizationalUnitsAsync();
        return Json(units.Select(u => new { u.Id, u.Name }));
    }

    // ─── تحذيرات النظام ────────

    public IActionResult SystemWarnings()
    {
        var auth = RequireAuth(); if (auth != null) return auth;
        if (CurrentUserRole != "Admin")
            return RedirectToAction("Index", "Forms");
        SetViewBagUser(_ui);
        ViewBag.PageName = "تحذيرات النظام";
        return View();
    }

    [HttpGet]
    public async Task<IActionResult> GetSystemWarnings()
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var data = await _ds.ListAllLoginAttemptsAsync();
        var units = await _ds.ListOrganizationalUnitsAsync();
        return Json(new
        {
            success = true,
            data = data.Select(a => new
            {
                a.Id,
                a.NationalId,
                a.FullName,
                a.OrganizationalUnit,
                a.WarningType,
                a.Severity,
                a.Description,
                a.IpAddress,
                a.Browser,
                a.OperatingSystem,
                Date = a.CreatedAt.ToString("yyyy-MM-dd"),
                Time = a.CreatedAt.ToString("HH:mm:ss")
            }),
            organizationalUnits = units.OrderBy(u => u.SortOrder).Select(u => new { u.Id, u.Name }).ToList()
        });
    }

    // ─── VIEWS ────────────────────────────────────────────────────────────────
    public IActionResult OrganizationalUnits()
    {
        var auth = RequireAuth(); if (auth != null) return auth;
        if (CurrentUserRole != "Admin")
            return RedirectToAction("Index", "Forms");
        SetViewBagUser(_ui);
        ViewBag.PageName = "الوحدات التنظيمية";
        return View();
    }

    public IActionResult Beneficiaries()
    {
        var auth = RequireAuth(); if (auth != null) return auth;
        if (CurrentUserRole != "Admin")
            return RedirectToAction("Index", "Forms");
        SetViewBagUser(_ui);
        ViewBag.PageName = "المستفيدين";
        return View();
    }

    public IActionResult Classifications()
    {
        var auth = RequireAuth(); if (auth != null) return auth;
        if (CurrentUserRole != "Admin")
            return RedirectToAction("Index", "Forms");
        SetViewBagUser(_ui);
        ViewBag.PageName = "التصنيفات التنظيمية";
        return View();
    }

    // ─── CLASSIFICATIONS API ──────────────────────────────────────────────────

    [HttpGet]
    public async Task<IActionResult> GetClassifications()
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var list = await _ds.ListClassificationsAsync();
        return Json(new
        {
            success = true,
            data = list.Select(c => new
            {
                c.Id,
                c.Name,
                c.Description,
                c.Color,
                c.SortOrder,
                c.IsActive,
                c.CreatedBy,
                c.UpdatedBy,
                CreatedAt = c.CreatedAt.ToString("yyyy-MM-dd"),
                UpdatedAt = c.UpdatedAt.HasValue ? c.UpdatedAt.Value.ToString("yyyy-MM-dd") : ""
            })
        });
    }

    [HttpPost]
    public async Task<IActionResult> AddClassification([FromBody] ClassificationRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        if (string.IsNullOrWhiteSpace(req.Name))
            return Json(new { success = false, message = "اسم التصنيف مطلوب" });

        var isDuplicate = await _ds.IsClassificationNameDuplicateAsync(req.Name.Trim());
        if (isDuplicate)
            return Json(new { success = false, message = "اسم التصنيف موجود مسبقاً، لا يمكن تكرار الاسم" });

        var all = await _ds.ListClassificationsAsync();
        var nextOrder = all.Count > 0 ? all.Max(c => c.SortOrder) + 1 : 1;

        var cls = new Classification
        {
            Name = req.Name.Trim(),
            Description = req.Description?.Trim() ?? "",
            Color = req.Color ?? "#25935F",
            SortOrder = nextOrder,
            IsActive = req.IsActive,
            CreatedBy = "مدير النظام"
        };

        await _ds.AddClassificationAsync(cls);
        await _ds.AddAuditLogAsync(BuildAuditEntry("إضافة تصنيف", "Classification", cls.Id.ToString(), cls.Name));

        return Json(new { success = true, message = "تم إضافة التصنيف بنجاح" });
    }

    [HttpPost]
    public async Task<IActionResult> UpdateClassification([FromBody] ClassificationUpdateRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        if (string.IsNullOrWhiteSpace(req.Name))
            return Json(new { success = false, message = "اسم التصنيف مطلوب" });

        var cls = await _ds.GetClassificationByIdAsync(req.Id);
        if (cls == null)
            return Json(new { success = false, message = "التصنيف غير موجود" });

        var isDuplicate = await _ds.IsClassificationNameDuplicateAsync(req.Name.Trim(), req.Id);
        if (isDuplicate)
            return Json(new { success = false, message = "اسم التصنيف موجود مسبقاً، لا يمكن تكرار الاسم" });

        var oldOrder = cls.SortOrder;
        cls.Name = req.Name.Trim();
        cls.Description = req.Description?.Trim() ?? "";
        cls.Color = req.Color ?? cls.Color;
        cls.IsActive = req.IsActive;
        cls.UpdatedBy = CurrentUserFullName;
        cls.UpdatedAt = DateTime.Now;

        await _ds.UpdateClassificationAsync(cls);

        if (req.SortOrder > 0 && req.SortOrder != oldOrder)
            await _ds.ReorderClassificationsAsync(cls.Id, req.SortOrder);

        await _ds.AddAuditLogAsync(BuildAuditEntry("تحديث تصنيف", "Classification", cls.Id.ToString(), cls.Name));

        return Json(new { success = true, message = "تم تحديث التصنيف بنجاح" });
    }

    [HttpPost]
    public async Task<IActionResult> DeleteClassification([FromBody] ClassificationDeleteRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var cls = await _ds.GetClassificationByIdAsync(req.Id);
        if (cls == null)
            return Json(new { success = false, message = "التصنيف غير موجود" });

        var isLinked = await _ds.IsClassificationLinkedAsync(req.Id);
        if (isLinked)
            return Json(new { success = false, message = "لا يمكن حذف هذا التصنيف لأنه مرتبط بوحدات تنظيمية" });

        await _ds.DeleteClassificationAsync(req.Id);

        var all = await _ds.ListClassificationsAsync();
        for (int i = 0; i < all.Count; i++)
            all[i].SortOrder = i + 1;
        foreach (var c in all)
            await _ds.UpdateClassificationAsync(c);

        await _ds.AddAuditLogAsync(BuildAuditEntry("حذف تصنيف", "Classification", req.Id.ToString(), cls.Name));

        return Json(new { success = true, message = "تم حذف التصنيف بنجاح" });
    }

    public IActionResult FormClasses()
    {
        var auth = RequireAuth(); if (auth != null) return auth;
        if (CurrentUserRole != "Admin")
            return RedirectToAction("Index", "Forms");
        SetViewBagUser(_ui);
        ViewBag.PageName = "أصناف النماذج";
        return View();
    }

    // ─── أصناف النماذج──────────────────────────

    [HttpGet]
    public async Task<IActionResult> GetFormClasses()
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var list = await _ds.ListFormClassesAsync();
        return Json(new
        {
            success = true,
            data = list.Select(c => new
            {
                c.Id,
                c.Name,
                c.Description,
                c.Color,
                c.Icon,
                c.SortOrder,
                c.IsActive,
                c.CreatedBy,
                c.UpdatedBy,
                CreatedAt = c.CreatedAt.ToString("yyyy-MM-dd"),
                UpdatedAt = c.UpdatedAt.HasValue ? c.UpdatedAt.Value.ToString("yyyy-MM-dd") : ""
            })
        });
    }

    [HttpPost]
    public async Task<IActionResult> AddFormClass([FromBody] FormClassRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        if (string.IsNullOrWhiteSpace(req.Name))
            return Json(new { success = false, message = "اسم الصنف مطلوب" });

        var isDuplicate = await _ds.IsFormClassNameDuplicateAsync(req.Name.Trim());
        if (isDuplicate)
            return Json(new { success = false, message = "اسم الصنف موجود مسبقاً، لا يمكن تكرار الاسم" });

        var all = await _ds.ListFormClassesAsync();
        var nextOrder = all.Count > 0 ? all.Max(c => c.SortOrder) + 1 : 1;

        var cls = new FormClass
        {
            Name = req.Name.Trim(),
            Description = req.Description?.Trim() ?? "",
            Color = req.Color ?? "#25935F",
            Icon = req.Icon ?? "",
            SortOrder = nextOrder,
            IsActive = req.IsActive,
            CreatedBy = "مدير النظام"
        };

        await _ds.AddFormClassAsync(cls);
        await _ds.AddAuditLogAsync(BuildAuditEntry("إضافة صنف نموذج", "FormClass", cls.Id.ToString(), cls.Name));

        return Json(new { success = true, message = "تم إضافة الصنف بنجاح" });
    }

    [HttpPost]
    public async Task<IActionResult> UpdateFormClass([FromBody] FormClassUpdateRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        if (string.IsNullOrWhiteSpace(req.Name))
            return Json(new { success = false, message = "اسم الصنف مطلوب" });

        var cls = await _ds.GetFormClassByIdAsync(req.Id);
        if (cls == null)
            return Json(new { success = false, message = "الصنف غير موجود" });

        var isDuplicate = await _ds.IsFormClassNameDuplicateAsync(req.Name.Trim(), req.Id);
        if (isDuplicate)
            return Json(new { success = false, message = "اسم الصنف موجود مسبقاً، لا يمكن تكرار الاسم" });

        var oldOrder = cls.SortOrder;
        cls.Name = req.Name.Trim();
        cls.Description = req.Description?.Trim() ?? "";
        cls.Color = req.Color ?? cls.Color;
        cls.Icon = req.Icon ?? cls.Icon;
        cls.IsActive = req.IsActive;
        cls.UpdatedBy = CurrentUserFullName;
        cls.UpdatedAt = DateTime.Now;

        await _ds.UpdateFormClassAsync(cls);

        if (req.SortOrder > 0 && req.SortOrder != oldOrder)
            await _ds.ReorderFormClassesAsync(cls.Id, req.SortOrder);

        await _ds.AddAuditLogAsync(BuildAuditEntry("تحديث صنف نموذج", "FormClass", cls.Id.ToString(), cls.Name));

        return Json(new { success = true, message = "تم تحديث الصنف بنجاح" });
    }

    [HttpPost]
    public async Task<IActionResult> DeleteFormClass([FromBody] FormClassDeleteRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var cls = await _ds.GetFormClassByIdAsync(req.Id);
        if (cls == null)
            return Json(new { success = false, message = "الصنف غير موجود" });

        await _ds.DeleteFormClassAsync(req.Id);

        var all = await _ds.ListFormClassesAsync();
        for (int i = 0; i < all.Count; i++)
            all[i].SortOrder = i + 1;
        foreach (var c in all)
            await _ds.UpdateFormClassAsync(c);

        await _ds.AddAuditLogAsync(BuildAuditEntry("حذف صنف نموذج", "FormClass", req.Id.ToString(), cls.Name));

        return Json(new { success = true, message = "تم حذف الصنف بنجاح" });
    }

    public IActionResult FormSections()
    {
        var auth = RequireAuth(); if (auth != null) return auth;
        if (CurrentUserRole != "Admin")
            return RedirectToAction("Index", "Forms");
        SetViewBagUser(_ui);
        ViewBag.PageName = "أنواع النماذج";
        return View();
    }

    // ─── أنواع النماذج------------------
    [HttpGet]
    public async Task<IActionResult> GetFormSections()
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var list = await _ds.ListFormSectionsAsync();
        return Json(new
        {
            success = true,
            data = list.Select(c => new
            {
                c.Id,
                c.Name,
                c.Description,
                c.Color,
                c.Icon,
                c.SortOrder,
                c.IsActive,
                c.CreatedBy,
                c.UpdatedBy,
                CreatedAt = c.CreatedAt.ToString("yyyy-MM-dd"),
                UpdatedAt = c.UpdatedAt.HasValue ? c.UpdatedAt.Value.ToString("yyyy-MM-dd") : ""
            })
        });
    }

    [HttpPost]
    public async Task<IActionResult> AddFormSection([FromBody] FormSectionRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        if (string.IsNullOrWhiteSpace(req.Name))
            return Json(new { success = false, message = "اسم النوع مطلوب" });

        if (await _ds.IsFormSectionNameDuplicateAsync(req.Name.Trim()))
            return Json(new { success = false, message = "اسم النوع موجود مسبقاً، لا يمكن تكرار الاسم" });

        var all = await _ds.ListFormSectionsAsync();
        var nextOrder = all.Count > 0 ? all.Max(c => c.SortOrder) + 1 : 1;

        var row = new FormSection
        {
            Name = req.Name.Trim(),
            Description = req.Description?.Trim() ?? "",
            Color = req.Color ?? "#25935F",
            Icon = req.Icon ?? "",
            SortOrder = nextOrder,
            IsActive = req.IsActive,
            CreatedBy = "مدير النظام"
        };

        await _ds.AddFormSectionAsync(row);
        await _ds.AddAuditLogAsync(BuildAuditEntry("إضافة نوع نموذج", "FormSection", row.Id.ToString(), row.Name));

        return Json(new { success = true, message = "تم إضافة النوع بنجاح" });
    }

    [HttpPost]
    public async Task<IActionResult> UpdateFormSection([FromBody] FormSectionUpdateRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        if (string.IsNullOrWhiteSpace(req.Name))
            return Json(new { success = false, message = "اسم النوع مطلوب" });

        var row = await _ds.GetFormSectionByIdAsync(req.Id);
        if (row == null)
            return Json(new { success = false, message = "النوع غير موجود" });

        if (await _ds.IsFormSectionNameDuplicateAsync(req.Name.Trim(), req.Id))
            return Json(new { success = false, message = "اسم النوع موجود مسبقاً، لا يمكن تكرار الاسم" });

        var oldOrder = row.SortOrder;
        row.Name = req.Name.Trim();
        row.Description = req.Description?.Trim() ?? "";
        row.Color = req.Color ?? row.Color;
        row.Icon = req.Icon ?? row.Icon;
        row.IsActive = req.IsActive;
        row.UpdatedBy = CurrentUserFullName;
        row.UpdatedAt = DateTime.Now;

        await _ds.UpdateFormSectionAsync(row);

        if (req.SortOrder > 0 && req.SortOrder != oldOrder)
            await _ds.ReorderFormSectionsAsync(row.Id, req.SortOrder);

        await _ds.AddAuditLogAsync(BuildAuditEntry("تحديث نوع نموذج", "FormSection", row.Id.ToString(), row.Name));

        return Json(new { success = true, message = "تم تحديث النوع بنجاح" });
    }

    [HttpPost]
    public async Task<IActionResult> DeleteFormSection([FromBody] FormSectionDeleteRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var row = await _ds.GetFormSectionByIdAsync(req.Id);
        if (row == null)
            return Json(new { success = false, message = "النوع غير موجود" });

        await _ds.DeleteFormSectionAsync(req.Id);

        var all = await _ds.ListFormSectionsAsync();
        for (int i = 0; i < all.Count; i++)
            all[i].SortOrder = i + 1;
        foreach (var c in all)
            await _ds.UpdateFormSectionAsync(c);

        await _ds.AddAuditLogAsync(BuildAuditEntry("حذف نوع نموذج", "FormSection", req.Id.ToString(), row.Name));

        return Json(new { success = true, message = "تم حذف النوع بنجاح" });
    }

    public IActionResult FormStatuses()
    {
        var auth = RequireAuth(); if (auth != null) return auth;
        if (CurrentUserRole != "Admin")
            return RedirectToAction("Index", "Forms");
        SetViewBagUser(_ui);
        ViewBag.PageName = "حالات النماذج";
        return View();
    }

    // ─── FORM STATUSES API (حالات النماذج) ─────────────────────────────────────

    [HttpGet]
    public async Task<IActionResult> GetFormStatuses()
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var list = await _ds.ListFormStatusesAsync();
        return Json(new
        {
            success = true,
            data = list.Select(s => new
            {
                s.Id,
                s.StatusCategory,
                s.Name,
                s.Description,
                s.Color,
                s.SortOrder,
                s.IsActive,
                s.CreatedBy,
                s.UpdatedBy,
                CreatedAt = s.CreatedAt.ToString("yyyy-MM-dd"),
                UpdatedAt = s.UpdatedAt.HasValue ? s.UpdatedAt.Value.ToString("yyyy-MM-dd") : ""
            })
        });
    }

    [HttpPost]
    public async Task<IActionResult> AddFormStatus([FromBody] FormStatusRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var cat = (req.StatusCategory ?? "").Trim();
        if (cat != "مفتوح" && cat != "مغلق")
            return Json(new { success = false, message = "تصنيف الحالة يجب أن يكون مفتوح أو مغلق" });

        if (string.IsNullOrWhiteSpace(req.Name))
            return Json(new { success = false, message = "اسم الحالة مطلوب" });

        if (await _ds.IsFormStatusNameDuplicateAsync(req.Name.Trim()))
            return Json(new { success = false, message = "اسم الحالة موجود مسبقاً، لا يمكن تكرار الاسم" });

        var all = await _ds.ListFormStatusesAsync();
        var nextOrder = all.Count > 0 ? all.Max(s => s.SortOrder) + 1 : 1;

        var row = new FormStatus
        {
            StatusCategory = cat,
            Name = req.Name.Trim(),
            Description = req.Description?.Trim() ?? "",
            Color = req.Color ?? "#25935F",
            SortOrder = nextOrder,
            IsActive = req.IsActive,
            CreatedBy = "مدير النظام"
        };

        await _ds.AddFormStatusAsync(row);
        await _ds.AddAuditLogAsync(BuildAuditEntry("إضافة حالة نموذج", "FormStatus", row.Id.ToString(), row.Name));

        return Json(new { success = true, message = "تم إضافة الحالة بنجاح" });
    }

    [HttpPost]
    public async Task<IActionResult> UpdateFormStatus([FromBody] FormStatusUpdateRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var cat = (req.StatusCategory ?? "").Trim();
        if (cat != "مفتوح" && cat != "مغلق")
            return Json(new { success = false, message = "تصنيف الحالة يجب أن يكون مفتوح أو مغلق" });

        if (string.IsNullOrWhiteSpace(req.Name))
            return Json(new { success = false, message = "اسم الحالة مطلوب" });

        var row = await _ds.GetFormStatusByIdAsync(req.Id);
        if (row == null)
            return Json(new { success = false, message = "الحالة غير موجودة" });

        if (await _ds.IsFormStatusNameDuplicateAsync(req.Name.Trim(), req.Id))
            return Json(new { success = false, message = "اسم الحالة موجود مسبقاً، لا يمكن تكرار الاسم" });

        var oldOrder = row.SortOrder;
        row.StatusCategory = cat;
        row.Name = req.Name.Trim();
        row.Description = req.Description?.Trim() ?? "";
        row.Color = req.Color ?? row.Color;
        row.IsActive = req.IsActive;
        row.UpdatedBy = CurrentUserFullName;
        row.UpdatedAt = DateTime.Now;

        await _ds.UpdateFormStatusAsync(row);

        if (req.SortOrder > 0 && req.SortOrder != oldOrder)
            await _ds.ReorderFormStatusesAsync(row.Id, req.SortOrder);

        await _ds.AddAuditLogAsync(BuildAuditEntry("تحديث حالة نموذج", "FormStatus", row.Id.ToString(), row.Name));

        return Json(new { success = true, message = "تم تحديث الحالة بنجاح" });
    }

    [HttpPost]
    public async Task<IActionResult> DeleteFormStatus([FromBody] FormStatusDeleteRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var row = await _ds.GetFormStatusByIdAsync(req.Id);
        if (row == null)
            return Json(new { success = false, message = "الحالة غير موجودة" });

        await _ds.DeleteFormStatusAsync(req.Id);

        var all = await _ds.ListFormStatusesAsync();
        for (int i = 0; i < all.Count; i++)
            all[i].SortOrder = i + 1;
        foreach (var s in all)
            await _ds.UpdateFormStatusAsync(s);

        await _ds.AddAuditLogAsync(BuildAuditEntry("حذف حالة نموذج", "FormStatus", req.Id.ToString(), row.Name));

        return Json(new { success = true, message = "تم حذف الحالة بنجاح" });
    }

    // ─── ORGANIZATIONAL UNITS ─────────────────────────────────────────────

    [HttpGet]
    public async Task<IActionResult> GetOrganizationalUnits()
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var units = await _ds.ListOrganizationalUnitsAsync();
        var classifications = await _ds.ListClassificationsAsync();
        return Json(new
        {
            success = true,
            data = units.Select(u => new
            {
                u.Id,
                u.Name,
                u.ClassificationId,
                ClassificationName = classifications.FirstOrDefault(c => c.Id == u.ClassificationId)?.Name ?? "",
                ClassificationColor = classifications.FirstOrDefault(c => c.Id == u.ClassificationId)?.Color ?? "#25935F",
                u.Level,
                u.ParentId,
                ParentName = u.ParentId.HasValue ? units.FirstOrDefault(p => p.Id == u.ParentId.Value)?.Name ?? "" : "",
                u.IsActive,
                u.SortOrder,
                u.CreatedBy,
                u.UpdatedBy,
                CreatedAt = u.CreatedAt.ToString("yyyy-MM-dd"),
                UpdatedAt = u.UpdatedAt.HasValue ? u.UpdatedAt.Value.ToString("yyyy-MM-dd") : ""
            }),
            classifications = classifications.Select(c => new { c.Id, c.Name, c.Color }).ToList(),
            mainUnits = units.Where(u => u.Level == "رئيسي").Select(u => new { u.Id, u.Name }).ToList()
        });
    }

    [HttpPost]
    public async Task<IActionResult> AddOrganizationalUnit([FromBody] OrgUnitRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        if (string.IsNullOrWhiteSpace(req.Name))
            return Json(new { success = false, message = "اسم الوحدة مطلوب" });

        var isDupName = await _ds.IsOrganizationalUnitNameDuplicateAsync(req.Name.Trim());
        if (isDupName)
            return Json(new { success = false, message = "اسم الوحدة موجود مسبقاً، لا يمكن تكرار الاسم" });

        var all = await _ds.ListOrganizationalUnitsAsync();
        var nextOrder = all.Count > 0 ? all.Max(u => u.SortOrder) + 1 : 1;

        var unit = new OrganizationalUnit
        {
            Name = req.Name.Trim(),
            ClassificationId = req.ClassificationId,
            Level = req.Level ?? "رئيسي",
            ParentId = req.Level == "فرعي" ? req.ParentId : null,
            IsActive = req.IsActive,
            SortOrder = nextOrder,
            CreatedBy = "مدير النظام"
        };

        await _ds.AddOrganizationalUnitAsync(unit);
        await _ds.AddAuditLogAsync(BuildAuditEntry("إضافة وحدة تنظيمية", "OrganizationalUnit", unit.Id.ToString(), unit.Name));

        return Json(new { success = true, message = "تم إضافة الوحدة بنجاح" });
    }

    [HttpPost]
    public async Task<IActionResult> UpdateOrganizationalUnit([FromBody] OrgUnitUpdateRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        if (string.IsNullOrWhiteSpace(req.Name))
            return Json(new { success = false, message = "اسم الوحدة مطلوب" });

        var unit = await _ds.GetOrganizationalUnitByIdAsync(req.Id);
        if (unit == null)
            return Json(new { success = false, message = "الوحدة غير موجودة" });

        var isDupName = await _ds.IsOrganizationalUnitNameDuplicateAsync(req.Name.Trim(), req.Id);
        if (isDupName)
            return Json(new { success = false, message = "اسم الوحدة موجود مسبقاً، لا يمكن تكرار الاسم" });

        var taken = await _ds.IsOrganizationalUnitSortOrderTakenAsync(req.SortOrder, req.Id);
        if (taken)
            return Json(new { success = false, message = "رقم الترتيب مستخدم مسبقاً" });

        unit.Name = req.Name.Trim();
        unit.ClassificationId = req.ClassificationId;
        unit.Level = req.Level ?? unit.Level;
        unit.ParentId = req.Level == "فرعي" ? req.ParentId : null;
        unit.IsActive = req.IsActive;
        unit.UpdatedBy = "مدير النظام";
        unit.UpdatedAt = DateTime.Now;

        await _ds.UpdateOrganizationalUnitAsync(unit);
        if (req.SortOrder > 0 && req.SortOrder != unit.SortOrder)
            await _ds.ReorderOrganizationalUnitsAsync(unit.Id, req.SortOrder);

        await _ds.AddAuditLogAsync(BuildAuditEntry("تحديث وحدة تنظيمية", "OrganizationalUnit", unit.Id.ToString(), unit.Name));

        return Json(new { success = true, message = "تم تحديث الوحدة بنجاح" });
    }

    [HttpPost]
    public async Task<IActionResult> DeleteOrganizationalUnit([FromBody] OrgUnitDeleteRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var unit = await _ds.GetOrganizationalUnitByIdAsync(req.Id);
        if (unit == null)
            return Json(new { success = false, message = "الوحدة غير موجودة" });

        var all = await _ds.ListOrganizationalUnitsAsync();
        if (all.Any(u => u.ParentId == req.Id))
            return Json(new { success = false, message = "لا يمكن حذف وحدة لديها وحدات فرعية" });

        await _ds.DeleteOrganizationalUnitAsync(req.Id);

        var remaining = await _ds.ListOrganizationalUnitsAsync();
        for (int i = 0; i < remaining.Count; i++)
        {
            remaining[i].SortOrder = i + 1;
            await _ds.UpdateOrganizationalUnitAsync(remaining[i]);
        }

        await _ds.AddAuditLogAsync(BuildAuditEntry("حذف وحدة تنظيمية", "OrganizationalUnit", req.Id.ToString(), unit.Name));

        return Json(new { success = true, message = "تم حذف الوحدة بنجاح" });
    }

    // ─── BENEFICIARIES API ────────────────────────────────────────────────────

    [HttpGet]
    public async Task<IActionResult> GetBeneficiaries()
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var list = await _ds.ListBeneficiariesAsync();
        var units = await _ds.ListOrganizationalUnitsAsync();
        return Json(new
        {
            success = true,
            data = list.Select(b => new
            {
                b.Id,
                b.NationalId,
                FullName = b.FullName,
                RoleDisplay = b.RoleDisplay,
                b.PhotoUrl,
                b.EndorsementType,
                b.EndorsementFile,
                b.SignatureType,
                b.SignatureFile,
                b.FirstName,
                b.SecondName,
                b.ThirdName,
                b.FourthName,
                b.OrganizationalUnitId,
                OrganizationalUnitName = units.FirstOrDefault(u => u.Id == b.OrganizationalUnitId)?.Name ?? "",
                b.Phone,
                b.Email,
                b.Username,
                b.IsActive,
                b.MainRole,
                b.SubRole
            }),
            organizationalUnits = units.OrderBy(u => u.SortOrder).Select(u => new { u.Id, u.Name, u.ParentId, u.SortOrder, u.Level }).ToList()
        });
    }

    [HttpPost]
    public async Task<IActionResult> AddBeneficiary([FromBody] BeneficiaryRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var err = ValidateBeneficiary(req, isAdd: true);
        if (err != null) return Json(new { success = false, message = err });

        var dup = await CheckBeneficiaryDuplicatesAsync(req.NationalId!.Trim(), req.Phone!.Trim(), req.Email!.Trim(), req.Username!.Trim(), excludeId: null);
        if (dup != null)
            return dup;

        if ((req.MainRole ?? "") == "مدير" && await _ds.HasManagerInUnitAsync(req.OrganizationalUnitId))
            return Json(new { success = false, message = "هذه الوحدة التنظيمية لديها مدير بالفعل. لا يمكن إضافة مدير آخر." });

        if (string.IsNullOrEmpty(req.Password))
            return Json(new { success = false, message = "كلمة المرور مطلوبة عند إضافة مستفيد جديد" });

        var b = new Beneficiary
        {
            PhotoUrl = req.PhotoUrl ?? "",
            NationalId = req.NationalId!.Trim(),
            EndorsementType = req.EndorsementType ?? "مرفق",
            EndorsementFile = req.EndorsementFile ?? "",
            SignatureType = req.SignatureType ?? "مرفق",
            SignatureFile = req.SignatureFile ?? "",
            FirstName = req.FirstName!.Trim(),
            SecondName = req.SecondName!.Trim(),
            ThirdName = req.ThirdName!.Trim(),
            FourthName = req.FourthName!.Trim(),
            OrganizationalUnitId = req.OrganizationalUnitId,
            Phone = req.Phone!.Trim(),
            Email = req.Email!.Trim(),
            Username = req.Username!.Trim(),
            IsActive = req.IsActive,
            MainRole = req.MainRole ?? "موظف",
            SubRole = req.SubRole ?? "",
            PasswordHash = _pw.Hash(req.Password)
        };

        await _ds.AddBeneficiaryAsync(b);

        var userRole = MapBeneficiaryToUserRole(b.MainRole, b.SubRole);
        var user = new User
        {
            NationalId = b.NationalId,
            Username = b.Username,
            Email = b.Email,
            Phone = b.Phone,
            PhotoUrl = b.PhotoUrl,
            FullName = b.FullName,
            PasswordHash = b.PasswordHash,
            Role = userRole,
            DepartmentId = b.OrganizationalUnitId,
            Status = b.IsActive ? AccountStatus.Active : AccountStatus.Inactive
        };
        await _ds.AddUserAsync(user);

        await _ds.AddAuditLogAsync(BuildAuditEntry("إضافة مستفيد", "Beneficiary", b.Id.ToString(), b.FullName));
        return Json(new { success = true, message = "تم إضافة المستفيد بنجاح" });
    }

    [HttpPost]
    public async Task<IActionResult> UpdateBeneficiary([FromBody] BeneficiaryUpdateRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var err = ValidateBeneficiary(req, isAdd: false);
        if (err != null) return Json(new { success = false, message = err });

        var b = await _ds.GetBeneficiaryByIdAsync(req.Id);
        if (b == null) return Json(new { success = false, message = "المستفيد غير موجود" });

        var dup = await CheckBeneficiaryDuplicatesAsync(req.NationalId!.Trim(), req.Phone!.Trim(), req.Email!.Trim(), req.Username!.Trim(), req.Id);
        if (dup != null)
            return dup;

        var newMainRole = req.MainRole ?? b.MainRole;
        if (newMainRole == "مدير" && (b.MainRole != "مدير" || b.OrganizationalUnitId != req.OrganizationalUnitId))
        {
            if (await _ds.HasManagerInUnitAsync(req.OrganizationalUnitId, req.Id))
                return Json(new { success = false, message = "هذه الوحدة التنظيمية لديها مدير بالفعل. لا يمكن إضافة مدير آخر." });
        }

        var oldUsername = b.Username;
        b.PhotoUrl = req.PhotoUrl ?? b.PhotoUrl;
        b.NationalId = req.NationalId!.Trim();
        b.EndorsementType = req.EndorsementType ?? b.EndorsementType;
        b.EndorsementFile = req.EndorsementFile ?? b.EndorsementFile;
        b.SignatureType = req.SignatureType ?? b.SignatureType;
        b.SignatureFile = req.SignatureFile ?? b.SignatureFile;
        b.FirstName = req.FirstName!.Trim();
        b.SecondName = req.SecondName!.Trim();
        b.ThirdName = req.ThirdName!.Trim();
        b.FourthName = req.FourthName!.Trim();
        b.OrganizationalUnitId = req.OrganizationalUnitId;
        b.Phone = req.Phone!.Trim();
        b.Email = req.Email!.Trim();
        b.Username = req.Username!.Trim();
        b.IsActive = req.IsActive;
        b.MainRole = newMainRole;
        b.SubRole = req.SubRole ?? "";
        b.UpdatedAt = DateTime.Now;
        if (!string.IsNullOrEmpty(req.Password))
            b.PasswordHash = _pw.Hash(req.Password);

        await _ds.UpdateBeneficiaryAsync(b);

        var existingUser = await _ds.GetUserByUsernameForBeneficiaryAsync(oldUsername);
        if (existingUser != null)
        {
            existingUser.Username = b.Username;
            existingUser.NationalId = b.NationalId;
            existingUser.Email = b.Email;
            existingUser.Phone = b.Phone;
            existingUser.PhotoUrl = b.PhotoUrl;
            existingUser.FullName = b.FullName;
            existingUser.Role = MapBeneficiaryToUserRole(b.MainRole, b.SubRole);
            existingUser.DepartmentId = b.OrganizationalUnitId;
            existingUser.Status = b.IsActive ? AccountStatus.Active : AccountStatus.Inactive;
            if (!string.IsNullOrEmpty(req.Password))
                existingUser.PasswordHash = b.PasswordHash;
            await _ds.UpdateUserAsync(existingUser);
        }

        await _ds.AddAuditLogAsync(BuildAuditEntry("تحديث مستفيد", "Beneficiary", b.Id.ToString(), b.FullName));
        return Json(new { success = true, message = "تم تحديث المستفيد بنجاح" });
    }

    [HttpPost]
    public async Task<IActionResult> DeleteBeneficiary([FromBody] BeneficiaryDeleteRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var b = await _ds.GetBeneficiaryByIdAsync(req.Id);
        if (b == null) return Json(new { success = false, message = "المستفيد غير موجود" });

        await _ds.DeleteBeneficiaryAsync(req.Id);
        await _ds.AddAuditLogAsync(BuildAuditEntry("حذف مستفيد", "Beneficiary", req.Id.ToString(), b.FullName));
        return Json(new { success = true, message = "تم حذف المستفيد بنجاح" });
    }

    private async Task<IActionResult?> CheckBeneficiaryDuplicatesAsync(string nationalId, string phone, string email, string username, int? excludeId)
    {
        if (await _ds.GetBeneficiaryByNationalIdAsync(nationalId, excludeId) != null)
            return Json(new { success = false, message = "رقم الهوية مسجل مسبقًا", duplicateField = "nationalId" });
        if (await _ds.GetBeneficiaryByPhoneAsync(phone, excludeId) != null)
            return Json(new { success = false, message = "رقم الجوال مستخدم من قبل", duplicateField = "phone" });
        if (await _ds.GetBeneficiaryByEmailAsync(email, excludeId) != null)
            return Json(new { success = false, message = "البريد الإلكتروني مستخدم مسبقًا", duplicateField = "email" });
        if (await _ds.GetBeneficiaryByUsernameAsync(username, excludeId) != null)
            return Json(new { success = false, message = "اسم المستخدم مستخدم مسبقًا", duplicateField = "username" });
        var existingUser = await _ds.GetUserByUsernameAsync(username);
        if (existingUser != null)
        {
            var matchBeneficiary = excludeId.HasValue ? await _ds.GetBeneficiaryByIdAsync(excludeId.Value) : null;
            if (matchBeneficiary == null || !matchBeneficiary.Username.Equals(username, StringComparison.OrdinalIgnoreCase))
                return Json(new { success = false, message = "اسم المستخدم مستخدم مسبقًا في النظام", duplicateField = "username" });
        }
        return null;
    }

    private static UserRole MapBeneficiaryToUserRole(string mainRole, string subRole)
    {
        if (subRole == "مدير النظام") return UserRole.Admin;
        if (mainRole == "مدير") return UserRole.Manager;
        if (subRole == "ممثل الوحدة التنظيمية") return UserRole.Employee;
        return UserRole.Staff;
    }

    private string? ValidateBeneficiary(dynamic req, bool isAdd)
    {
        if (string.IsNullOrWhiteSpace(req.NationalId))
            return "الهوية الوطنية مطلوبة";
        var nid = ((string?)req.NationalId ?? "").Trim();
        if (nid.Length != 10 || !nid.All(c => char.IsDigit(c)))
            return "الهوية الوطنية يجب أن تتكون من 10 أرقام وتبدأ بـ 10 أو 11";
        if (!nid.StartsWith("10") && !nid.StartsWith("11"))
            return "الهوية الوطنية يجب أن تتكون من 10 أرقام وتبدأ بـ 10 أو 11";

        if (string.IsNullOrWhiteSpace(req.Phone))
            return "رقم الجوال مطلوب";
        var phone = ((string?)req.Phone ?? "").Trim();
        if (!phone.StartsWith("05"))
            return "رقم الجوال يجب أن يبدأ بـ 05";
        if (phone.Length < 10 || !phone.All(c => char.IsDigit(c)))
            return "رقم الجوال يجب أن يبدأ بـ 05";

        if (string.IsNullOrWhiteSpace(req.Email))
            return "البريد الإلكتروني مطلوب";
        var email = ((string?)req.Email ?? "").Trim();
        if (!System.Text.RegularExpressions.Regex.IsMatch(email, @"^[^\s@]+@almadinah\.gov\.sa$", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
            return "يجب إدخال بريد إلكتروني بصيغة xxx@almadinah.gov.sa";

        if (string.IsNullOrWhiteSpace(req.Username))
            return "اسم المستخدم مطلوب";
        var username = ((string?)req.Username ?? "").Trim();
        if (username.Length < 3)
            return "اسم المستخدم يجب أن يكون 3 أحرف على الأقل";
        if (!System.Text.RegularExpressions.Regex.IsMatch(username, @"^[a-zA-Z0-9_]+$"))
            return "اسم المستخدم يجب أن يحتوي على أحرف إنجليزية وأرقام فقط";

        if (string.IsNullOrWhiteSpace(req.MainRole))
            return "الدور الرئيسي مطلوب";
        if (req.MainRole != "موظف" && req.MainRole != "مدير")
            return "الدور الرئيسي يجب أن يكون موظف أو مدير";

        if (string.IsNullOrWhiteSpace(req.FirstName)) return "الاسم الأول مطلوب";
        if (string.IsNullOrWhiteSpace(req.SecondName)) return "الاسم الثاني مطلوب";
        if (string.IsNullOrWhiteSpace(req.ThirdName)) return "الاسم الثالث مطلوب";
        if (string.IsNullOrWhiteSpace(req.FourthName)) return "الاسم الرابع مطلوب";
        if (req.OrganizationalUnitId <= 0) return "الوحدة التنظيمية مطلوبة";

        var pwd = (string?)req.Password;
        var confirm = (string?)req.ConfirmPassword;
        if (!string.IsNullOrEmpty(pwd) && pwd != (confirm ?? ""))
            return "كلمة المرور وتأكيد كلمة المرور غير متطابقتين";
        if (!string.IsNullOrEmpty(pwd))
        {
            var pwdErr = ValidateBeneficiaryPasswordStrength(pwd);
            if (pwdErr != null) return pwdErr;
        }
        return null;
    }

    private static string? ValidateBeneficiaryPasswordStrength(string password)
    {
        if (password.Length < 8)
            return "كلمة المرور يجب أن تكون 8 أحرف على الأقل (يُفضّل 12 حرفًا أو أكثر).";
        if (!password.Any(c => c is >= 'A' and <= 'Z'))
            return "كلمة المرور يجب أن تحتوي على حرف كبير (A-Z).";
        if (!password.Any(c => c is >= 'a' and <= 'z'))
            return "كلمة المرور يجب أن تحتوي على حرف صغير (a-z).";
        if (!password.Any(c => c is >= '0' and <= '9'))
            return "كلمة المرور يجب أن تحتوي على رقم واحد على الأقل (0-9).";
        const string specials = "!@#$%^&*";
        if (!password.Any(c => specials.Contains(c)))
            return "كلمة المرور يجب أن تحتوي على رمز خاص من المجموعة: ! @ # $ % ^ & *";
        return null;
    }
}

public class BeneficiaryRequest
{
    public string? PhotoUrl { get; set; }
    public string? NationalId { get; set; }
    public string? EndorsementType { get; set; }
    public string? EndorsementFile { get; set; }
    public string? SignatureType { get; set; }
    public string? SignatureFile { get; set; }
    public string? FirstName { get; set; }
    public string? SecondName { get; set; }
    public string? ThirdName { get; set; }
    public string? FourthName { get; set; }
    public int OrganizationalUnitId { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Username { get; set; }
    public bool IsActive { get; set; } = true;
    public string? MainRole { get; set; }
    public string? SubRole { get; set; }
    public string? Password { get; set; }
    public string? ConfirmPassword { get; set; }
}

public class BeneficiaryUpdateRequest : BeneficiaryRequest
{
    public int Id { get; set; }
}

public class BeneficiaryDeleteRequest
{
    public int Id { get; set; }
}

public class OrgUnitRequest
{
    public string Name { get; set; } = "";
    public int ClassificationId { get; set; }
    public string? Level { get; set; } = "رئيسي";
    public int? ParentId { get; set; }
    public bool IsActive { get; set; } = true;
}

public class OrgUnitUpdateRequest
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int ClassificationId { get; set; }
    public string? Level { get; set; }
    public int? ParentId { get; set; }
    public bool IsActive { get; set; }
    public int SortOrder { get; set; }
}

public class OrgUnitDeleteRequest
{
    public int Id { get; set; }
}

public class ClassificationRequest
{
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string? Color { get; set; }
    public bool IsActive { get; set; } = true;
}

public class ClassificationUpdateRequest
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string? Color { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public class ClassificationDeleteRequest
{
    public int Id { get; set; }
}

public class FormClassRequest
{
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string? Color { get; set; }
    public string? Icon { get; set; }
    public bool IsActive { get; set; } = true;
}

public class FormClassUpdateRequest
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string? Color { get; set; }
    public string? Icon { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public class FormClassDeleteRequest
{
    public int Id { get; set; }
}

public class FormSectionRequest
{
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string? Color { get; set; }
    public string? Icon { get; set; }
    public bool IsActive { get; set; } = true;
}

public class FormSectionUpdateRequest
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string? Color { get; set; }
    public string? Icon { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public class FormSectionDeleteRequest
{
    public int Id { get; set; }
}

public class FormStatusRequest
{
    public string StatusCategory { get; set; } = "مفتوح";
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string? Color { get; set; }
    public bool IsActive { get; set; } = true;
}

public class FormStatusUpdateRequest
{
    public int Id { get; set; }
    public string StatusCategory { get; set; } = "مفتوح";
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string? Color { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public class FormStatusDeleteRequest
{
    public int Id { get; set; }
}

