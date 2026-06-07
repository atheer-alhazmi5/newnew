using System.Collections.Generic;
using System.IO.Compression;
using System.Linq;
using FormsSystem.Models.Entities;
using FormsSystem.Models.Enums;
using FormsSystem.Services;
using Microsoft.AspNetCore.Authorization;
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
        var depts = await _ds.ListDepartmentsAsync();
        var users = await _ds.ListUsersAsync();
        var nidByUserId = BuildNationalIdByUserId(users);
        var ouByUserId = BuildOrganizationalUnitNameByUserId(users, depts, orgUnits);

        return Json(new
        {
            success = true,
            data = logs.Select((l, idx) => new
            {
                l.Id,
                l.UserId,
                l.UserName,
                NationalId = ResolveNationalIdForAudit(l, nidByUserId),
                OrganizationalUnit = ResolveOrganizationalUnitForAudit(l, ouByUserId),
                l.Action,
                l.EntityType,
                l.EntityId,
                l.Details,
                l.IpAddress,
                l.Browser,
                l.OperatingSystem,
                CreatedAt = l.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss")
            }),
            organizationalUnits = DataService.FilterEffectivelyActiveOrganizationalUnits(orgUnits)
                .Select(u => new { u.Id, u.Name, u.ParentId, u.SortOrder }).ToList(),
            beneficiaries = beneficiaries.Where(b => b.IsActive)
                .Select(b => new { b.Id, b.FullName, b.NationalId, b.OrganizationalUnitId }).ToList()
        });
    }

    [HttpGet]
    public async Task<IActionResult> ExportAuditLogsPdf()
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Unauthorized();

        var logs = await _ds.ListAllAuditLogsAsync();
        var users = await _ds.ListUsersAsync();
        var depts = await _ds.ListDepartmentsAsync();
        var orgUnits = await _ds.ListOrganizationalUnitsAsync();
        var nidByUserId = BuildNationalIdByUserId(users);
        var ouByUserId = BuildOrganizationalUnitNameByUserId(users, depts, orgUnits);
        var columns = new List<string> { "#", "رقم الهوية", "اسم المستفيد", "الوحدة التنظيمية", "العملية", "التاريخ والوقت", "المتصفح", "عنوان IP", "نظام التشغيل" };
        var rows = logs.Select((l, i) => new Dictionary<string, string>
        {
            ["#"] = (i + 1).ToString(),
            ["رقم الهوية"] = ResolveNationalIdForAudit(l, nidByUserId),
            ["اسم المستفيد"] = l.UserName,
            ["الوحدة التنظيمية"] = ResolveOrganizationalUnitForAudit(l, ouByUserId),
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
        var users = await _ds.ListUsersAsync();
        var depts = await _ds.ListDepartmentsAsync();
        var orgUnits = await _ds.ListOrganizationalUnitsAsync();
        var nidByUserId = BuildNationalIdByUserId(users);
        var ouByUserId = BuildOrganizationalUnitNameByUserId(users, depts, orgUnits);
        var headers = new List<string> { "#", "رقم الهوية", "اسم المستفيد", "الوحدة التنظيمية", "العملية", "التاريخ والوقت", "المتصفح", "عنوان IP", "نظام التشغيل" };
        var rows = logs.Select((l, i) => new List<string>
        {
            (i + 1).ToString(),
            ResolveNationalIdForAudit(l, nidByUserId),
            l.UserName,
            ResolveOrganizationalUnitForAudit(l, ouByUserId),
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
        SetViewBagUser(_ui);
        ViewBag.PageName = "النسخ الاحتياطي";
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
                : new List<string> { "جميع الوحدات" },
            ViewerCount = (p.ViewedBy ?? new List<PopupViewEntry>()).Select(v => v.UserId).Distinct().Count()
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

    private static string? ValidatePopupNotificationDates(string? displayPeriod, DateTime? startDate, DateTime? endDate)
    {
        if (!string.Equals(displayPeriod?.Trim(), "specific", StringComparison.OrdinalIgnoreCase))
            return null;
        if (!startDate.HasValue || !endDate.HasValue)
            return "تاريخ البداية وتاريخ النهاية مطلوبان عند اختيار «عرض لفترة محددة»";
        var start = startDate.Value.Date;
        var end = endDate.Value.Date;
        var today = DateTime.Today;
        if (start < today)
            return "تاريخ البداية لا يمكن أن يكون قبل تاريخ اليوم";
        if (end < today)
            return "تاريخ النهاية لا يمكن أن يكون قبل تاريخ اليوم";
        if (end <= start)
            return "تاريخ النهاية يجب أن يكون بعد تاريخ البداية";
        return null;
    }

    private static void NormalizePopupNotificationDates(PopupNotification req)
    {
        if (!string.Equals(req.DisplayPeriod?.Trim(), "specific", StringComparison.OrdinalIgnoreCase))
        {
            req.StartDate = null;
            req.EndDate = null;
            return;
        }
        if (req.StartDate.HasValue) req.StartDate = req.StartDate.Value.Date;
        if (req.EndDate.HasValue) req.EndDate = req.EndDate.Value.Date;
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

        var dateErr = ValidatePopupNotificationDates(req.DisplayPeriod, req.StartDate, req.EndDate);
        if (dateErr != null)
            return Json(new { success = false, message = dateErr });
        NormalizePopupNotificationDates(req);

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
            req.ViewedBy = existing.ViewedBy;
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
    [AllowAnonymous]
    public async Task<IActionResult> GetActivePopups(string location)
    {
        var loc = (location ?? "").Trim();
     
        if (!IsAuthenticated)
        {
            var allowAnon = string.Equals(loc, "landing", StringComparison.OrdinalIgnoreCase)
                || string.Equals(loc, "login", StringComparison.OrdinalIgnoreCase);
            if (!allowAnon)
                return Json(new List<object>());
        }

        var userId = IsAuthenticated ? CurrentUserId : 0;
        var deptId = IsAuthenticated ? CurrentDeptId : 0;
        var username = IsAuthenticated ? CurrentUserName : null;
        var popups = await _ds.GetActivePopupsForUserAsync(userId, deptId, loc, username);
        return Json(popups.Select(p => new
        {
            p.Id, p.Title, p.TitleColor, p.TitleFontSize,
            p.Category, p.ContentType,
            p.TextContent, p.AttachmentUrl, p.AttachmentMime, p.ExternalUrl,
            p.DisplayPeriod
        }));
    }

    [HttpPost]
    public async Task<IActionResult> RecordPopupView(int id)
    {
        if (!IsAuthenticated)
            return Json(new { success = true });
        await _ds.RecordPopupViewAsync(id, CurrentUserId);
        return Json(new { success = true });
    }

    [HttpPost]
    public async Task<IActionResult> DismissPopup(int id)
    {
        if (!IsAuthenticated)
            return Json(new { success = true });
        await _ds.DismissPopupAsync(id, CurrentUserId);
        return Json(new { success = true });
    }

    [HttpGet]
    public async Task<IActionResult> GetPopupViewers(int id)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Unauthorized();
        var p = await _ds.GetPopupNotificationAsync(id);
        if (p == null) return Json(new { success = false, message = "الإشعار غير موجود" });
        var rows = await _ds.GetPopupViewerRowsAsync(id);
        return Json(new
        {
            success = true,
            title = p.Title,
            data = rows.Select(r => new
            {
                r.UserId,
                FullName = r.FullName,
                OrgUnitName = r.OrgUnitName,
                ViewedAt = r.ViewedAt.ToString("yyyy-MM-dd HH:mm")
            }).ToList()
        });
    }

    public class PublishPopupRequest { public bool Publish { get; set; } }

    [HttpGet]
    public async Task<IActionResult> GetUsersForPopup()
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin") return Unauthorized();
        var beneficiaries = await _ds.ListBeneficiariesAsync();
        var activeBenUsernames = beneficiaries
            .Where(b => b.IsActive)
            .Select(b => b.Username.ToLower())
            .ToHashSet();
        var benByUsername = beneficiaries
            .Where(b => b.IsActive)
            .ToDictionary(b => b.Username.ToLower(), b => b);
        var orgUnits = await _ds.ListOrganizationalUnitsAsync();
        var ouMap = orgUnits.ToDictionary(o => o.Id, o => o.Name);
        var users = await _ds.ListUsersAsync();
        var filtered = users.Where(u =>
            u.Status == AccountStatus.Active &&
            (u.Role == UserRole.Admin || activeBenUsernames.Contains(u.Username.ToLower()))
        ).ToList();
        return Json(filtered.Select(u => {
            var ouId = 0;
            var ouName = "";
            var isUnitManager = false;
            if (benByUsername.TryGetValue(u.Username.ToLower(), out var ben))
            {
                ouId = ben.OrganizationalUnitId ?? 0;
                isUnitManager = ben.IsUnitManager;
                ouMap.TryGetValue(ouId, out ouName);
                ouName ??= "";
            }
            else
            {
                ouId = u.DepartmentId ?? 0;
                ouName = u.Department?.Name ?? "";
            }
            return new { u.Id, FullName = u.FullName, DepartmentId = ouId, DepartmentName = ouName, IsUnitManager = isUnitManager };
        }));
    }

    [HttpGet]
    public async Task<IActionResult> GetDeptsForPopup()
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin") return Unauthorized();
        var units = await _ds.ListActiveOrganizationalUnitsAsync();
        return Json(units.Select(u => new { u.Id, u.Name, u.ParentId, Level = EffectiveOrgUnitLevel(u), u.SortOrder }));
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
        var units = await _ds.ListActiveOrganizationalUnitsAsync();
        var users = await _ds.ListUsersAsync();
        var depts = await _ds.ListDepartmentsAsync();
        var allOrgUnits = await _ds.ListOrganizationalUnitsAsync();
        var nidByUsername = BuildNationalIdByUsernameLower(users);
        var ouByUsername = BuildOrganizationalUnitNameByUsernameLower(users, depts, allOrgUnits);
        return Json(new
        {
            success = true,
            data = data.Select(a => new
            {
                a.Id,
                NationalId = ResolveNationalIdForLoginAttempt(a, nidByUsername),
                a.FullName,
                OrganizationalUnit = ResolveOrganizationalUnitForLoginAttempt(a, ouByUsername),
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
        var auditLogs = await _ds.ListAllAuditLogsAsync();
        var creatorByEntityId = MapCreatorUserNameFromAudit(auditLogs, "Classification", "إضافة تصنيف");

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
                CreatedBy = ResolveStoredCreatedByDisplay(c.CreatedBy, c.Id, creatorByEntityId),
                c.UpdatedBy,
                CreatedAt = c.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
                UpdatedAt = c.UpdatedAt.HasValue ? c.UpdatedAt.Value.ToString("yyyy-MM-dd HH:mm") : ""
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
            CreatedBy = CurrentUserFullName ?? CurrentUserName ?? ""
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
            return Json(new { success = false, message = "هذا العنصر مرتبط بعنصر آخر ولا يمكن حذفه. يمكن تعطيله بدلًا من الحذف" });

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
        var auditLogs = await _ds.ListAllAuditLogsAsync();
        var creatorById = MapCreatorUserNameFromAudit(auditLogs, "FormClass", "إضافة صنف نموذج");
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
                CreatedBy = ResolveStoredCreatedByDisplay(c.CreatedBy, c.Id, creatorById),
                c.UpdatedBy,
                CreatedAt = c.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
                UpdatedAt = c.UpdatedAt.HasValue ? c.UpdatedAt.Value.ToString("yyyy-MM-dd HH:mm") : ""
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
            CreatedBy = CurrentUserFullName ?? CurrentUserName ?? ""
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
        cls.UpdatedBy = CurrentUserFullName ?? CurrentUserName ?? "";
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

        if (await _ds.IsFormClassLinkedAsync(req.Id))
            return Json(new { success = false, message = "هذا العنصر مرتبط بعنصر آخر ولا يمكن حذفه. يمكن تعطيله بدلًا من الحذف" });

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
        var auditLogs = await _ds.ListAllAuditLogsAsync();
        var creatorById = MapCreatorUserNameFromAudit(auditLogs, "FormSection", "إضافة نوع نموذج", "إضافة قسم نموذج");
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
                CreatedBy = ResolveStoredCreatedByDisplay(c.CreatedBy, c.Id, creatorById),
                c.UpdatedBy,
                CreatedAt = c.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
                UpdatedAt = c.UpdatedAt.HasValue ? c.UpdatedAt.Value.ToString("yyyy-MM-dd HH:mm") : ""
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
            CreatedBy = CurrentUserFullName ?? CurrentUserName ?? ""
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
        row.UpdatedBy = CurrentUserFullName ?? CurrentUserName ?? "";
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

        if (await _ds.IsFormSectionLinkedAsync(req.Id))
            return Json(new { success = false, message = "هذا العنصر مرتبط بعنصر آخر ولا يمكن حذفه. يمكن تعطيله بدلًا من الحذف" });

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
        ViewBag.PageName = "حالات الطلبات";
        return View();
    }

    // ─── FORM STATUSES API (حالات النماذج) ─────────────────────────────────────

    [HttpGet]
    public async Task<IActionResult> GetFormStatuses()
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var list = await _ds.ListFormStatusesAsync();
        var auditLogs = await _ds.ListAllAuditLogsAsync();
        var beneficiaries = await _ds.ListBeneficiariesAsync();
        var users = await _ds.ListUsersAsync();
        var benByNid = BuildBeneficiaryFullNameByNationalId(beneficiaries);
        var userById = BuildUserFullNameById(users);
        var creatorById = MapCreatorUserDisplayFromAudit(auditLogs, benByNid, userById, "FormStatus", "إضافة حالة نموذج");
        var lastUpdaterById = MapLastAuditActorDisplayByEntity(auditLogs, benByNid, userById, "FormStatus", "تحديث حالة نموذج");

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
                CreatedBy = ResolveFormStatusCreatedByDisplay(s.CreatedBy, s.Id, creatorById),
                UpdatedBy = ResolveFormStatusUpdatedByDisplay(s.UpdatedBy, s.Id, lastUpdaterById),
                CreatedAt = s.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
                UpdatedAt = s.UpdatedAt.HasValue ? s.UpdatedAt.Value.ToString("yyyy-MM-dd HH:mm") : ""
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
            CreatedBy = CurrentUserFullName ?? CurrentUserName ?? ""
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
        row.UpdatedBy = CurrentUserFullName ?? CurrentUserName ?? "";
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

        if (await _ds.IsFormStatusLinkedAsync(req.Id))
            return Json(new { success = false, message = "هذا العنصر مرتبط بعنصر آخر ولا يمكن حذفه. يمكن تعطيله بدلًا من الحذف" });

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

    /// <summary>مستوى العرض والمنطق: يُحدَّد من وجود أب وليس من قيمة Level المخزَّنة قديماً.</summary>
    private static string EffectiveOrgUnitLevel(OrganizationalUnit u) =>
        u.ParentId.HasValue ? "فرعي" : "رئيسي";

    private static string? ValidateOrganizationalUnitParent(int unitIdBeingSaved, int? parentId, List<OrganizationalUnit> all)
    {
        if (!parentId.HasValue || parentId.Value <= 0) return null;
        if (!all.Exists(x => x.Id == parentId.Value)) return "الوحدة التنظيمية الرئيسية غير موجودة";
        if (unitIdBeingSaved > 0 && parentId.Value == unitIdBeingSaved)
            return "لا يمكن أن تكون الوحدة تابعة لنفسها";
        var visited = new HashSet<int>();
        int? walk = parentId;
        while (walk.HasValue && walk.Value > 0)
        {
            if (!visited.Add(walk.Value)) return "هيكل الوحدات غير صالح";
            if (unitIdBeingSaved > 0 && walk.Value == unitIdBeingSaved)
                return "لا يمكن اختيار وحدة فرعية ضمن هذه الوحدة كرئيس لها";
            var node = all.FirstOrDefault(x => x.Id == walk.Value);
            walk = node?.ParentId;
            if (visited.Count > all.Count + 5) break;
        }
        return null;
    }

    private static void ApplyOrgUnitHierarchyFromParent(OrganizationalUnit unit, int? parentId)
    {
        var pid = parentId.HasValue && parentId.Value > 0 ? parentId : null;
        unit.ParentId = pid;
        unit.Level = pid.HasValue ? "فرعي" : "رئيسي";
    }

    [HttpGet]
    public async Task<IActionResult> GetOrganizationalUnits()
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var units = await _ds.ListOrganizationalUnitsAsync();
        if (units.Any(u => string.IsNullOrWhiteSpace(u.OrderPath)))
            await _ds.RecalculateOrganizationalUnitHierarchyAsync();
        units = await _ds.ListOrganizationalUnitsAsync();
        var beneficiaries = await _ds.ListBeneficiariesAsync();
        var memberCountByOu = beneficiaries
            .Where(b => b.OrganizationalUnitId.HasValue && b.OrganizationalUnitId.Value > 0)
            .GroupBy(b => b.OrganizationalUnitId!.Value)
            .ToDictionary(g => g.Key, g => g.Count());
        var unitManagerNamesByOu = beneficiaries
            .Where(b => b.IsActive && b.IsUnitManager && b.OrganizationalUnitId.HasValue && b.OrganizationalUnitId.Value > 0)
            .GroupBy(b => b.OrganizationalUnitId!.Value)
            .ToDictionary(
                g => g.Key,
                g => string.Join("، ", g.OrderBy(x => x.FullName).Select(x => x.FullName.Trim()).Where(s => s.Length > 0)));

        var memberFullNamesByOu = beneficiaries
            .Where(b => b.OrganizationalUnitId.HasValue && b.OrganizationalUnitId.Value > 0)
            .GroupBy(b => b.OrganizationalUnitId!.Value)
            .ToDictionary(
                g => g.Key,
                g => g.OrderBy(x => x.FullName ?? "").Select(x => (x.FullName ?? "").Trim()).Where(fn => fn.Length > 0).ToList());

        var classifications = await _ds.ListClassificationsAsync();
        var activeClassifications = classifications.Where(c => c.IsActive).OrderBy(c => c.SortOrder).ToList();
        var auditLogs = await _ds.ListAllAuditLogsAsync();
        var ouCreatorById = MapCreatorUserNameFromAudit(auditLogs, "OrganizationalUnit", "إضافة وحدة تنظيمية");
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
                Level = EffectiveOrgUnitLevel(u),
                u.ParentId,
                ParentName = u.ParentId.HasValue ? units.FirstOrDefault(p => p.Id == u.ParentId.Value)?.Name ?? "" : "",
                MemberCount = memberCountByOu.TryGetValue(u.Id, out var mc) ? mc : 0,
                Members = memberFullNamesByOu.TryGetValue(u.Id, out var mfn) ? mfn : new List<string>(),
                UnitManagerName = unitManagerNamesByOu.TryGetValue(u.Id, out var mn) ? mn : "",
                HasUnitManager = !string.IsNullOrWhiteSpace(mn),
                u.IsActive,
                u.SortOrder,
                u.OrderPath,
                CreatedBy = ResolveStoredCreatedByDisplay(u.CreatedBy, u.Id, ouCreatorById),
                u.UpdatedBy,
                CreatedAt = u.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
                UpdatedAt = u.UpdatedAt.HasValue ? u.UpdatedAt.Value.ToString("yyyy-MM-dd HH:mm") : ""
            }),
            classifications = activeClassifications.Select(c => new { c.Id, c.Name, c.Color }).ToList(),
            mainUnits = DataService.FilterEffectivelyActiveOrganizationalUnits(units)
                .Where(u => !u.ParentId.HasValue)
                .Select(u => new { u.Id, u.Name }).ToList()
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
        var parentErr = ValidateOrganizationalUnitParent(0, req.ParentId, all);
        if (parentErr != null)
            return Json(new { success = false, message = parentErr });

        var parentId = req.ParentId.HasValue && req.ParentId.Value > 0 ? req.ParentId : null;
        var nextOrder = await _ds.GetNextOrganizationalUnitSiblingSortOrderAsync(parentId);

        var unit = new OrganizationalUnit
        {
            Name = req.Name.Trim(),
            ClassificationId = req.ClassificationId,
            IsActive = req.IsActive,
            SortOrder = nextOrder,
            CreatedBy = CurrentUserFullName ?? CurrentUserName ?? ""
        };
        ApplyOrgUnitHierarchyFromParent(unit, parentId);

        await _ds.AddOrganizationalUnitAsync(unit);
        await _ds.RecalculateOrganizationalUnitHierarchyAsync();
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

        var all = await _ds.ListOrganizationalUnitsAsync();
        var parentErr = ValidateOrganizationalUnitParent(req.Id, req.ParentId, all);
        if (parentErr != null)
            return Json(new { success = false, message = parentErr });

        var newParentId = req.ParentId.HasValue && req.ParentId.Value > 0 ? req.ParentId : null;
        var parentChanged = unit.ParentId != newParentId;

        unit.Name = req.Name.Trim();
        unit.ClassificationId = req.ClassificationId;
        ApplyOrgUnitHierarchyFromParent(unit, newParentId);
        unit.IsActive = req.IsActive;
        unit.UpdatedBy = CurrentUserFullName ?? CurrentUserName ?? "";
        unit.UpdatedAt = DateTime.Now;

        if (parentChanged)
            unit.SortOrder = await _ds.GetNextOrganizationalUnitSiblingSortOrderAsync(newParentId, req.Id);

        await _ds.UpdateOrganizationalUnitAsync(unit);
        if (!req.IsActive)
            await _ds.CascadeDeactivateOrganizationalUnitDescendantsAsync(unit.Id, unit.UpdatedBy, unit.UpdatedAt ?? DateTime.Now);
        await _ds.RecalculateOrganizationalUnitHierarchyAsync();

        await _ds.AddAuditLogAsync(BuildAuditEntry("تحديث وحدة تنظيمية", "OrganizationalUnit", unit.Id.ToString(), unit.Name));

        var msg = req.IsActive
            ? "تم تحديث الوحدة بنجاح"
            : "تم تحديث الوحدة وتعطيل جميع الوحدات التابعة لها";
        return Json(new { success = true, message = msg });
    }

    [HttpPost]
    public async Task<IActionResult> DeleteOrganizationalUnit([FromBody] OrgUnitDeleteRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var unit = await _ds.GetOrganizationalUnitByIdAsync(req.Id);
        if (unit == null)
            return Json(new { success = false, message = "الوحدة غير موجودة" });

        var isLinked = await _ds.IsOrganizationalUnitLinkedAsync(req.Id);
        if (isLinked)
            return Json(new { success = false, message = "هذا العنصر مرتبط بعنصر آخر ولا يمكن حذفه. يمكن تعطيله بدلًا من الحذف" });

        await _ds.DeleteOrganizationalUnitAsync(req.Id);
        await _ds.RecalculateOrganizationalUnitHierarchyAsync();

        await _ds.AddAuditLogAsync(BuildAuditEntry("حذف وحدة تنظيمية", "OrganizationalUnit", req.Id.ToString(), unit.Name));

        return Json(new { success = true, message = "تم حذف الوحدة بنجاح" });
    }
//
    // ─── BENEFICIARIES API ────────────────────────────────────────────────────

    [HttpGet]
    public async Task<IActionResult> GetBeneficiaries()
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var list = await _ds.ListBeneficiariesAsync();
        var units = await _ds.ListOrganizationalUnitsAsync();
        var activeUnits = DataService.FilterEffectivelyActiveOrganizationalUnits(units);
        return Json(new
        {
            success = true,
            data = list.Select(b => new
            {
                b.Id,
                b.NationalId,
                FullName = b.FullName,
                RoleDisplay = b.RoleDisplay,
                RoleDisplayTable = b.RoleDisplayTable,
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
                OrganizationalUnitName = GetBeneficiaryOrganizationalUnitName(b.OrganizationalUnitId, units),
                b.Phone,
                b.Email,
                b.Username,
                b.IsActive,
                DeactivateReason = b.DeactivateReason ?? "",
                b.MainRole,
                b.IsUnitManager,
                b.SubRole,
                b.CreatedBy,
                b.UpdatedBy,
                CreatedAt = b.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
                UpdatedAt = b.UpdatedAt.HasValue ? b.UpdatedAt.Value.ToString("yyyy-MM-dd HH:mm") : ""
            }),
            organizationalUnits = activeUnits.Select(u => new { u.Id, u.Name, u.ParentId, u.SortOrder }).ToList()
        });
    }

    [HttpPost]
    public async Task<IActionResult> AddBeneficiary([FromBody] BeneficiaryRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var err = ValidateBeneficiary(req, isAdd: true);
        if (err != null) return Json(new { success = false, message = err });

        if (IsBeneficiarySysAdminRole(req.SubRole))
        {
            var defErr = ApplySysAdminBeneficiaryDefaultsForAdd(req);
            if (defErr != null) return Json(new { success = false, message = defErr });
        }

        var dup = await CheckBeneficiaryDuplicatesAsync(req.NationalId, req.Phone, req.Email, req.Username!.Trim(), excludeId: null);
        if (dup != null)
            return dup;

        if (req.IsUnitManager
            && req.OrganizationalUnitId.HasValue
            && req.OrganizationalUnitId.Value > 0
            && await _ds.HasManagerInUnitAsync(req.OrganizationalUnitId.Value))
            return Json(new { success = false, message = "هذه الوحدة التنظيمية لديها مدير بالفعل. لا يمكن إضافة مدير آخر." });

        if (string.IsNullOrEmpty(req.Password))
            return Json(new { success = false, message = "كلمة المرور مطلوبة عند إضافة مستفيد جديد" });

        var b = new Beneficiary
        {
            PhotoUrl = req.PhotoUrl ?? "",
            NationalId = string.IsNullOrWhiteSpace(req.NationalId) ? null : req.NationalId.Trim(),
            EndorsementType = req.EndorsementType ?? "مرفق",
            EndorsementFile = req.EndorsementFile ?? "",
            SignatureType = req.SignatureType ?? "مرفق",
            SignatureFile = req.SignatureFile ?? "",
            FirstName = req.FirstName!.Trim(),
            SecondName = req.SecondName!.Trim(),
            ThirdName = req.ThirdName!.Trim(),
            FourthName = req.FourthName!.Trim(),
            OrganizationalUnitId = IsBeneficiarySysAdminRole(req.SubRole)
                ? null
                : (req.OrganizationalUnitId.HasValue && req.OrganizationalUnitId.Value > 0 ? req.OrganizationalUnitId : null),
            Phone = string.IsNullOrWhiteSpace(req.Phone) ? null : req.Phone.Trim(),
            Email = string.IsNullOrWhiteSpace(req.Email) ? null : req.Email.Trim(),
            Username = req.Username!.Trim(),
            IsActive = req.IsActive,
            DeactivateReason = req.IsActive ? "" : (req.DeactivateReason ?? "").Trim(),
            MainRole = "موظف",
            IsUnitManager = req.IsUnitManager,
            SubRole = req.SubRole ?? "",
            PasswordHash = _pw.Hash(req.Password),
            CreatedBy = CurrentUserFullName
        };

        await _ds.AddBeneficiaryAsync(b);

        var userRole = MapBeneficiaryToUserRole(b.IsUnitManager, b.SubRole);
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

        if (IsBeneficiarySysAdminRole(req.SubRole))
        {
            req.NationalId = string.IsNullOrWhiteSpace(req.NationalId) ? null : req.NationalId.Trim();
            req.Phone = string.IsNullOrWhiteSpace(req.Phone) ? null : req.Phone.Trim();
            req.Email = string.IsNullOrWhiteSpace(req.Email) ? null : req.Email.Trim();
            if (!(req.OrganizationalUnitId.HasValue && req.OrganizationalUnitId.Value > 0))
                req.OrganizationalUnitId = null;
            if (string.IsNullOrWhiteSpace(req.EndorsementFile)) req.EndorsementFile = b.EndorsementFile;
            if (string.IsNullOrWhiteSpace(req.SignatureFile)) req.SignatureFile = b.SignatureFile;
        }

        var dup = await CheckBeneficiaryDuplicatesAsync(req.NationalId, req.Phone, req.Email, req.Username!.Trim(), req.Id);
        if (dup != null)
            return dup;

        var newIsUnitManager = req.IsUnitManager;
        var reqOuId = req.OrganizationalUnitId;
        if (newIsUnitManager
            && reqOuId.HasValue
            && reqOuId.Value > 0
            && (!b.IsUnitManager || b.OrganizationalUnitId != reqOuId))
        {
            if (await _ds.HasManagerInUnitAsync(reqOuId.Value, req.Id))
                return Json(new { success = false, message = "هذه الوحدة التنظيمية لديها مدير بالفعل. لا يمكن إضافة مدير آخر." });
        }

        var oldUsername = b.Username;
        b.PhotoUrl = req.PhotoUrl ?? b.PhotoUrl;
        b.NationalId = string.IsNullOrWhiteSpace(req.NationalId) ? null : req.NationalId.Trim();
        b.EndorsementType = req.EndorsementType ?? b.EndorsementType;
        b.EndorsementFile = string.IsNullOrWhiteSpace(req.EndorsementFile) ? b.EndorsementFile : req.EndorsementFile!;
        b.SignatureType = req.SignatureType ?? b.SignatureType;
        b.SignatureFile = string.IsNullOrWhiteSpace(req.SignatureFile) ? b.SignatureFile : req.SignatureFile!;
        b.FirstName = req.FirstName!.Trim();
        b.SecondName = req.SecondName!.Trim();
        b.ThirdName = req.ThirdName!.Trim();
        b.FourthName = req.FourthName!.Trim();
        b.OrganizationalUnitId = req.OrganizationalUnitId;
        b.Phone = string.IsNullOrWhiteSpace(req.Phone) ? null : req.Phone.Trim();
        b.Email = string.IsNullOrWhiteSpace(req.Email) ? null : req.Email.Trim();
        b.Username = req.Username!.Trim();
        b.IsActive = req.IsActive;
        b.DeactivateReason = req.IsActive ? "" : (req.DeactivateReason ?? "").Trim();
        b.MainRole = "موظف";
        b.IsUnitManager = newIsUnitManager;
        b.SubRole = req.SubRole ?? "";
        b.UpdatedBy = CurrentUserFullName;
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
            existingUser.Role = MapBeneficiaryToUserRole(b.IsUnitManager, b.SubRole);
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

        var deleteBlock = await _ds.GetBeneficiaryDeletionBlockReasonAsync(req.Id);
        if (!string.IsNullOrWhiteSpace(deleteBlock))
            return Json(new { success = false, message = deleteBlock });

        await _ds.DeleteBeneficiaryAsync(req.Id);
        if (!string.IsNullOrEmpty(b.Username))
            await _ds.DeleteUserByUsernameAsync(b.Username);
        await _ds.AddAuditLogAsync(BuildAuditEntry("حذف مستفيد", "Beneficiary", req.Id.ToString(), b.FullName));
        return Json(new { success = true, message = "تم حذف المستفيد بنجاح" });
    }

    private async Task<IActionResult?> CheckBeneficiaryDuplicatesAsync(string? nationalId, string? phone, string? email, string username, int? excludeId)
    {
        if (!string.IsNullOrWhiteSpace(nationalId))
        {
            var nid = nationalId.Trim();
            if (await _ds.GetBeneficiaryByNationalIdAsync(nid, excludeId) != null)
                return Json(new { success = false, message = "رقم الهوية مسجل مسبقًا", duplicateField = "nationalId" });
        }
        if (!string.IsNullOrWhiteSpace(phone))
        {
            var p = phone.Trim();
            if (await _ds.GetBeneficiaryByPhoneAsync(p, excludeId) != null)
                return Json(new { success = false, message = "رقم الجوال مستخدم من قبل", duplicateField = "phone" });
        }
        if (!string.IsNullOrWhiteSpace(email))
        {
            var em = email.Trim();
            if (await _ds.GetBeneficiaryByEmailAsync(em, excludeId) != null)
                return Json(new { success = false, message = "البريد الإلكتروني مستخدم مسبقًا", duplicateField = "email" });
        }
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

    private static UserRole MapBeneficiaryToUserRole(bool isUnitManager, string subRole)
    {
        var sr = (subRole ?? "").Trim();
        if (sr == "مدير النظام") return UserRole.Admin;
        // مدير وحدة يُخزَّن مع SubRole=مستفيد فعلي؛ يُقيَّم قبل تعيين دور الموظف العادي
        if (isUnitManager) return UserRole.Manager;
        if (sr == "ممثل الوحدة التنظيمية") return UserRole.Employee;
        if (sr == "موظف ") return UserRole.Staff;
        return UserRole.Staff;
    }

    private static bool IsBeneficiarySysAdminRole(string? subRole) =>
        string.Equals((subRole ?? "").Trim(), "مدير النظام", StringComparison.Ordinal);

    private static string GetBeneficiaryOrganizationalUnitName(int? organizationalUnitId, IEnumerable<OrganizationalUnit> units)
    {
        if (!organizationalUnitId.HasValue || organizationalUnitId.Value <= 0) return "";
        return units.FirstOrDefault(u => u.Id == organizationalUnitId.Value)?.Name ?? "";
    }

    /// <summary>
    /// مدير النظام: لا هوية/جوال/بريد/وحدة — تُخزَّن كقيم null في قاعدة البيانات (بدون توليد عشوائي).
    /// </summary>
    private static string? ApplySysAdminBeneficiaryDefaultsForAdd(BeneficiaryRequest req)
    {
        req.NationalId = null;
        req.Phone = null;
        req.Email = null;
        req.OrganizationalUnitId = null;
        req.IsUnitManager = false;
        if (string.IsNullOrWhiteSpace(req.EndorsementType)) req.EndorsementType = "مرفق";
        req.EndorsementFile ??= "";
        if (string.IsNullOrWhiteSpace(req.SignatureType)) req.SignatureType = "مرفق";
        req.SignatureFile ??= "";
        return null;
    }

    private string? ValidateBeneficiary(dynamic req, bool isAdd)
    {
        var subRole = ((string?)req.SubRole ?? "").Trim();
        if (subRole != "مستفيد فعلي" && subRole != "ممثل الوحدة التنظيمية" && subRole != "مدير النظام")
            return "اختر الدور: مستفيد فعلي أو مدير نظام";

        if (subRole == "ممثل الوحدة التنظيمية" && req.IsUnitManager == true)
            return "صفة ممثل الوحدة لا تُدمج مع مدير وحدة تنظيمية";

        if (IsBeneficiarySysAdminRole(subRole))
        {
            if (string.IsNullOrWhiteSpace(req.Username))
                return "اسم المستخدم مطلوب";
            var usernameSa = ((string?)req.Username ?? "").Trim();
            if (usernameSa.Length < 3)
                return "اسم المستخدم يجب أن يكون 3 أحرف على الأقل";
            if (!System.Text.RegularExpressions.Regex.IsMatch(usernameSa, @"^[a-zA-Z0-9_]+$"))
                return "اسم المستخدم يجب أن يحتوي على أحرف إنجليزية وأرقام فقط";

            if (string.IsNullOrWhiteSpace(req.FirstName)) return "الاسم الأول مطلوب";
            if (string.IsNullOrWhiteSpace(req.SecondName)) return "الاسم الثاني مطلوب";
            if (string.IsNullOrWhiteSpace(req.ThirdName)) return "الاسم الثالث مطلوب";
            if (string.IsNullOrWhiteSpace(req.FourthName)) return "الاسم الرابع مطلوب";

            var pwd = (string?)req.Password;
            var confirm = (string?)req.ConfirmPassword;
            if (!string.IsNullOrEmpty(pwd) && pwd != (confirm ?? ""))
                return "كلمة المرور وتأكيد كلمة المرور غير متطابقتين";
            if (isAdd && string.IsNullOrEmpty(pwd))
                return "كلمة المرور مطلوبة عند إضافة مستفيد جديد";
            if (!string.IsNullOrEmpty(pwd))
            {
                var pwdErr = ValidateBeneficiaryPasswordStrength(pwd);
                if (pwdErr != null) return pwdErr;
            }
            var deactivateErrSa = ValidateBeneficiaryDeactivateReason(req.IsActive, req.DeactivateReason);
            if (deactivateErrSa != null) return deactivateErrSa;
            return null;
        }

        if (string.IsNullOrWhiteSpace(req.NationalId))
            return "رقم الهوية مطلوب";
        var nid = ((string?)req.NationalId ?? "").Trim();
        if (nid.Length != 10 || !nid.All(char.IsDigit))
            return "رقم الهوية يجب أن يتكون من 10 أرقام فقط";
        if (!nid.StartsWith('1'))
            return "رقم الهوية يجب أن يبدأ بالرقم 1";

        if (string.IsNullOrWhiteSpace(req.Phone))
            return "رقم الجوال مطلوب";
        var phone = ((string?)req.Phone ?? "").Trim();
        if (phone.Length != 10 || !phone.All(char.IsDigit) || !phone.StartsWith("05", StringComparison.Ordinal))
            return "رقم الجوال ١٠ ارقام تبدا ب ٠٥";

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

        if (string.IsNullOrWhiteSpace(req.FirstName)) return "الاسم الأول مطلوب";
        if (string.IsNullOrWhiteSpace(req.SecondName)) return "الاسم الثاني مطلوب";
        if (string.IsNullOrWhiteSpace(req.ThirdName)) return "الاسم الثالث مطلوب";
        if (string.IsNullOrWhiteSpace(req.FourthName)) return "الاسم الرابع مطلوب";
        if ((req.OrganizationalUnitId ?? 0) <= 0) return "الوحدة التنظيمية مطلوبة";

        var pwdRep = (string?)req.Password;
        var confirmRep = (string?)req.ConfirmPassword;
        if (!string.IsNullOrEmpty(pwdRep) && pwdRep != (confirmRep ?? ""))
            return "كلمة المرور وتأكيد كلمة المرور غير متطابقتين";
        if (!string.IsNullOrEmpty(pwdRep))
        {
            var pwdErr = ValidateBeneficiaryPasswordStrength(pwdRep);
            if (pwdErr != null) return pwdErr;
        }

        var deactivateErr = ValidateBeneficiaryDeactivateReason(req.IsActive, req.DeactivateReason);
        if (deactivateErr != null) return deactivateErr;
        return null;
    }

    private static string? ValidateBeneficiaryDeactivateReason(bool isActive, string? deactivateReason)
    {
        if (isActive) return null;
        if (string.IsNullOrWhiteSpace(deactivateReason))
            return "سبب التعطيل مطلوب عند اختيار حالة معطل";
        return null;
    }

    private static Dictionary<int, string> BuildNationalIdByUserId(IEnumerable<User> users)
    {
        var d = new Dictionary<int, string>();
        foreach (var u in users)
        {
            if (string.IsNullOrWhiteSpace(u.NationalId)) continue;
            var nid = u.NationalId.Trim();
            if (!d.ContainsKey(u.Id)) d[u.Id] = nid;
        }
        return d;
    }

    private static Dictionary<string, string> BuildNationalIdByUsernameLower(IEnumerable<User> users)
    {
        var d = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var u in users)
        {
            var key = (u.Username ?? "").Trim().ToLowerInvariant();
            if (string.IsNullOrEmpty(key) || string.IsNullOrWhiteSpace(u.NationalId)) continue;
            var nid = u.NationalId.Trim();
            if (!d.ContainsKey(key)) d[key] = nid;
        }
        return d;
    }

    private static string ResolveNationalIdForAudit(AuditLog l, Dictionary<int, string> nidByUserId)
    {
        if (!string.IsNullOrWhiteSpace(l.NationalId)) return l.NationalId;
        if (l.UserId > 0 && nidByUserId.TryGetValue(l.UserId, out var nid)) return nid;
        return l.NationalId ?? "";
    }

    private static string ResolveNationalIdForLoginAttempt(LoginAttempt a, Dictionary<string, string> nidByUsernameLower)
    {
        if (!string.IsNullOrWhiteSpace(a.NationalId)) return a.NationalId;
        var key = (a.UsernameAttempted ?? "").Trim().ToLowerInvariant();
        if (!string.IsNullOrEmpty(key) && nidByUsernameLower.TryGetValue(key, out var nid))
            return nid;
        return a.NationalId ?? "";
    }

    private static string ResolveUnitDisplayName(int? departmentId, IEnumerable<Department> depts, IEnumerable<OrganizationalUnit> orgUnits)
    {
        if (!departmentId.HasValue || departmentId.Value <= 0) return "";
        var d = depts.FirstOrDefault(x => x.Id == departmentId.Value);
        if (d != null && !string.IsNullOrWhiteSpace(d.Name)) return d.Name.Trim();
        var ou = orgUnits.FirstOrDefault(x => x.Id == departmentId.Value);
        return ou?.Name?.Trim() ?? "";
    }

    private static Dictionary<int, string> BuildOrganizationalUnitNameByUserId(
        IEnumerable<User> users, IEnumerable<Department> depts, IEnumerable<OrganizationalUnit> orgUnits)
    {
        var map = new Dictionary<int, string>();
        foreach (var u in users)
        {
            var name = ResolveUnitDisplayName(u.DepartmentId, depts, orgUnits);
            if (string.IsNullOrEmpty(name)) continue;
            if (!map.ContainsKey(u.Id)) map[u.Id] = name;
        }
        return map;
    }

    private static Dictionary<string, string> BuildOrganizationalUnitNameByUsernameLower(
        IEnumerable<User> users, IEnumerable<Department> depts, IEnumerable<OrganizationalUnit> orgUnits)
    {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var u in users)
        {
            var key = (u.Username ?? "").Trim().ToLowerInvariant();
            if (string.IsNullOrEmpty(key)) continue;
            var name = ResolveUnitDisplayName(u.DepartmentId, depts, orgUnits);
            if (string.IsNullOrEmpty(name)) continue;
            if (!map.ContainsKey(key)) map[key] = name;
        }
        return map;
    }

    private static string ResolveOrganizationalUnitForAudit(AuditLog l, Dictionary<int, string> ouByUserId)
    {
        if (!string.IsNullOrWhiteSpace(l.OrganizationalUnit)) return l.OrganizationalUnit;
        if (l.UserId > 0 && ouByUserId.TryGetValue(l.UserId, out var name)) return name;
        return l.OrganizationalUnit ?? "";
    }

    private static string ResolveOrganizationalUnitForLoginAttempt(LoginAttempt a, Dictionary<string, string> ouByUsernameLower)
    {
        if (!string.IsNullOrWhiteSpace(a.OrganizationalUnit)) return a.OrganizationalUnit;
        var key = (a.UsernameAttempted ?? "").Trim().ToLowerInvariant();
        if (!string.IsNullOrEmpty(key) && ouByUsernameLower.TryGetValue(key, out var name))
            return name;
        return a.OrganizationalUnit ?? "";
    }
 
    private static Dictionary<string, string> MapCreatorUserNameFromAudit(
        IEnumerable<AuditLog> logs,
        string entityType,
        params string[] addActions)
    {
        if (addActions == null || addActions.Length == 0)
            return new Dictionary<string, string>(StringComparer.Ordinal);
        var actionSet = new HashSet<string>(addActions, StringComparer.Ordinal);
        return logs
            .Where(l => string.Equals(l.EntityType, entityType, StringComparison.Ordinal)
                && !string.IsNullOrEmpty(l.EntityId)
                && actionSet.Contains(l.Action))
            .GroupBy(l => l.EntityId!, StringComparer.Ordinal)
            .ToDictionary(
                g => g.Key,
                g => g.OrderBy(x => x.CreatedAt)
                    .Select(x => (x.UserName ?? "").Trim())
                    .FirstOrDefault(u => !string.IsNullOrEmpty(u)) ?? "",
                StringComparer.Ordinal);
    }

  
    private static string ResolveStoredCreatedByDisplay(
        string? storedCreatedBy,
        int entityId,
        IReadOnlyDictionary<string, string> creatorFromAudit)
    {
        var s = (storedCreatedBy ?? "").Trim();
        if (!string.IsNullOrEmpty(s) && !string.Equals(s, "مدير النظام", StringComparison.Ordinal))
            return s;
        if (creatorFromAudit.TryGetValue(entityId.ToString(), out var fromAudit))
        {
            var a = (fromAudit ?? "").Trim();
            if (!string.IsNullOrEmpty(a)) return a;
        }
        return "";
    }

    private static string ResolveFormStatusCreatedByDisplay(
        string? storedCreatedBy,
        int entityId,
        IReadOnlyDictionary<string, string> creatorFromAudit)
    {
        if (creatorFromAudit.TryGetValue(entityId.ToString(), out var fromAudit))
        {
            var a = (fromAudit ?? "").Trim();
            if (!string.IsNullOrEmpty(a)) return a;
        }
        var s = (storedCreatedBy ?? "").Trim();
        if (!string.IsNullOrEmpty(s) && !string.Equals(s, "مدير النظام", StringComparison.Ordinal))
            return s;
        return "";
    }

    private static string ResolveFormStatusUpdatedByDisplay(
        string? storedUpdatedBy,
        int entityId,
        IReadOnlyDictionary<string, string> lastUpdaterFromAudit)
    {
        if (lastUpdaterFromAudit.TryGetValue(entityId.ToString(), out var fromAudit))
        {
            var a = (fromAudit ?? "").Trim();
            if (!string.IsNullOrEmpty(a)) return a;
        }
        return (storedUpdatedBy ?? "").Trim();
    }

    private static Dictionary<string, string> BuildBeneficiaryFullNameByNationalId(IEnumerable<Beneficiary> beneficiaries)
    {
        return beneficiaries
            .Where(b => !string.IsNullOrWhiteSpace(b.NationalId))
            .GroupBy(b => b.NationalId!.Trim(), StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => (g.First().FullName ?? "").Trim(), StringComparer.Ordinal);
    }

    private static Dictionary<int, string> BuildUserFullNameById(IEnumerable<User> users)
        => users.ToDictionary(u => u.Id, u => (u.FullName ?? "").Trim());

    private static string ResolveAuditLogActorDisplay(
        AuditLog x,
        IReadOnlyDictionary<string, string> benFullByNationalId,
        IReadOnlyDictionary<int, string> userFullById)
    {
        var nid = (x.NationalId ?? "").Trim();
        if (!string.IsNullOrEmpty(nid) && benFullByNationalId.TryGetValue(nid, out var bn) && !string.IsNullOrWhiteSpace(bn))
            return bn.Trim();
        if (x.UserId > 0 && userFullById.TryGetValue(x.UserId, out var un) && !string.IsNullOrWhiteSpace(un))
            return un.Trim();
        return (x.UserName ?? "").Trim();
    }

    private static Dictionary<string, string> MapCreatorUserDisplayFromAudit(
        IEnumerable<AuditLog> logs,
        IReadOnlyDictionary<string, string> benFullByNationalId,
        IReadOnlyDictionary<int, string> userFullById,
        string entityType,
        params string[] addActions)
    {
        if (addActions == null || addActions.Length == 0)
            return new Dictionary<string, string>(StringComparer.Ordinal);
        var actionSet = new HashSet<string>(addActions, StringComparer.Ordinal);
        return logs
            .Where(l => string.Equals(l.EntityType, entityType, StringComparison.Ordinal)
                && !string.IsNullOrEmpty(l.EntityId)
                && actionSet.Contains(l.Action))
            .GroupBy(l => l.EntityId!, StringComparer.Ordinal)
            .ToDictionary(
                g => g.Key,
                g =>
                {
                    var x = g.OrderBy(a => a.CreatedAt).First();
                    return ResolveAuditLogActorDisplay(x, benFullByNationalId, userFullById);
                },
                StringComparer.Ordinal);
    }

    private static Dictionary<string, string> MapLastAuditActorDisplayByEntity(
        IEnumerable<AuditLog> logs,
        IReadOnlyDictionary<string, string> benFullByNationalId,
        IReadOnlyDictionary<int, string> userFullById,
        string entityType,
        string action)
    {
        return logs
            .Where(l => string.Equals(l.EntityType, entityType, StringComparison.Ordinal)
                && !string.IsNullOrEmpty(l.EntityId)
                && string.Equals(l.Action, action, StringComparison.Ordinal))
            .GroupBy(l => l.EntityId!, StringComparer.Ordinal)
            .ToDictionary(
                g => g.Key,
                g =>
                {
                    var x = g.OrderByDescending(a => a.CreatedAt).First();
                    return ResolveAuditLogActorDisplay(x, benFullByNationalId, userFullById);
                },
                StringComparer.Ordinal);
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

    // ─── DELEGATIONS ──────────────────────────────────────────────────────────
    public IActionResult Delegations()
    {
        var auth = RequireAuth(); if (auth != null) return auth;
        if (CurrentUserRole != "Admin")
            return RedirectToAction("Index", "Forms");
        SetViewBagUser(_ui);
        ViewBag.PageName = "التفويضات";
        return View();
    }

    [HttpGet]
    public async Task<IActionResult> GetDelegations()
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var list = await _ds.ListDelegationsAsync();
        var bens = await _ds.ListBeneficiariesAsync();
        var units = await _ds.ListOrganizationalUnitsAsync();
        var activeUnits = DataService.FilterEffectivelyActiveOrganizationalUnits(units);

        var benById = bens.ToDictionary(b => b.Id);
        var unitById = units.ToDictionary(u => u.Id);

        var data = list.Select(d =>
        {
            benById.TryGetValue(d.DelegatorBeneficiaryId, out var dor);
            benById.TryGetValue(d.DelegateeBeneficiaryId, out var dee);
            unitById.TryGetValue(d.DelegatorOrgUnitId, out var dorU);
            unitById.TryGetValue(d.DelegateeOrgUnitId, out var deeU);
            return new
            {
                d.Id,
                d.ReferenceNumber,
                DelegationReason = d.DelegationReason ?? "",
                d.DelegatorBeneficiaryId,
                DelegatorName = dor?.FullName ?? "",
                d.DelegatorOrgUnitId,
                DelegatorOrgUnitName = dorU?.Name ?? "",
                d.DelegateeBeneficiaryId,
                DelegateeName = dee?.FullName ?? "",
                DelegatorRoleDisplay = dor?.RoleDisplayTable ?? "",
                DelegateeRoleDisplay = dee?.RoleDisplayTable ?? "",
                d.DelegateeOrgUnitId,
                DelegateeOrgUnitName = deeU?.Name ?? "",
                StartDate = d.StartDate.ToString("yyyy-MM-dd"),
                EndDate = d.EndDate.ToString("yyyy-MM-dd"),
                StatusCode = ComputeDelegationStatus(d),
                CancellationReason = d.CancellationReason ?? "",
                d.CancelledBy,
                CancelledAt = d.CancelledAt?.ToString("yyyy-MM-dd HH:mm"),
                d.CreatedBy,
                CreatedAt = d.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
                d.UpdatedBy,
                UpdatedAt = d.UpdatedAt?.ToString("yyyy-MM-dd HH:mm")
            };
        }).ToList();

        return Json(new
        {
            success = true,
            data,
            organizationalUnits = activeUnits.Select(u => new { u.Id, u.Name, u.ParentId, u.SortOrder }).ToList(),
            beneficiaries = bens.Where(b => b.IsActive)
                .Select(b => new { b.Id, FullName = b.FullName, b.OrganizationalUnitId, RoleDisplay = b.RoleDisplayTable })
                .OrderBy(x => x.FullName).ToList()
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetDelegation(int id)
    {
        if (!IsAuthenticated)
            return Json(new { success = false, message = "غير مصرح" });

        var d = await _ds.GetDelegationByIdAsync(id);
        if (d == null) return Json(new { success = false, message = "غير موجود" });

        if (CurrentUserRole != "Admin")
        {
            var username = CurrentUserName?.Trim();
            if (string.IsNullOrEmpty(username))
                return Json(new { success = false, message = "غير مصرح" });
            var me = await _ds.GetBeneficiaryByUsernameAsync(username, null);
            if (me == null || (me.Id != d.DelegatorBeneficiaryId && me.Id != d.DelegateeBeneficiaryId))
                return Json(new { success = false, message = "غير مصرح" });
        }

        var bens = await _ds.ListBeneficiariesAsync();
        var units = await _ds.ListOrganizationalUnitsAsync();
        var dor = bens.FirstOrDefault(b => b.Id == d.DelegatorBeneficiaryId);
        var dee = bens.FirstOrDefault(b => b.Id == d.DelegateeBeneficiaryId);
        var dorU = units.FirstOrDefault(u => u.Id == d.DelegatorOrgUnitId);
        var deeU = units.FirstOrDefault(u => u.Id == d.DelegateeOrgUnitId);

        return Json(new
        {
            success = true,
            data = new
            {
                d.Id,
                d.ReferenceNumber,
                DelegationReason = d.DelegationReason ?? "",
                d.DelegatorBeneficiaryId,
                DelegatorName = dor?.FullName ?? "",
                DelegatorRoleDisplay = dor?.RoleDisplayTable ?? "",
                d.DelegatorOrgUnitId,
                DelegatorOrgUnitName = dorU?.Name ?? "",
                d.DelegateeBeneficiaryId,
                DelegateeName = dee?.FullName ?? "",
                DelegateeRoleDisplay = dee?.RoleDisplayTable ?? "",
                d.DelegateeOrgUnitId,
                DelegateeOrgUnitName = deeU?.Name ?? "",
                StartDate = d.StartDate.ToString("yyyy-MM-dd"),
                EndDate = d.EndDate.ToString("yyyy-MM-dd"),
                d.Status,
                StatusCode = ComputeDelegationStatus(d),
                CancellationReason = d.CancellationReason ?? "",
                d.CancelledBy,
                CancelledAt = d.CancelledAt?.ToString("yyyy-MM-dd HH:mm"),
                d.CreatedBy,
                CreatedAt = d.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
                d.UpdatedBy,
                UpdatedAt = d.UpdatedAt?.ToString("yyyy-MM-dd HH:mm")
            }
        });
    }

    /// <summary>التفويضات التي يشارك فيها المستخدم الحالي كمفوِّض أو مفوَّض له.</summary>
    [HttpGet]
    public async Task<IActionResult> GetMyDelegations()
    {
        if (!IsAuthenticated)
            return Json(new { success = false, message = "غير مصرح" });

        var username = CurrentUserName?.Trim();
        if (string.IsNullOrEmpty(username))
            return Json(new { success = true, myBeneficiaryId = (int?)null, data = Array.Empty<object>() });

        var me = await _ds.GetBeneficiaryByUsernameAsync(username, null);
        if (me == null)
            return Json(new { success = true, myBeneficiaryId = (int?)null, data = Array.Empty<object>() });

        var list = await _ds.ListDelegationsAsync();
        var bens = await _ds.ListBeneficiariesAsync();
        var units = await _ds.ListOrganizationalUnitsAsync();
        var benById = bens.ToDictionary(b => b.Id);
        var unitById = units.ToDictionary(u => u.Id);

        var filtered = list.Where(d => d.DelegatorBeneficiaryId == me.Id || d.DelegateeBeneficiaryId == me.Id).ToList();

        var data = filtered.Select(d =>
        {
            benById.TryGetValue(d.DelegatorBeneficiaryId, out var dor);
            benById.TryGetValue(d.DelegateeBeneficiaryId, out var dee);
            unitById.TryGetValue(d.DelegatorOrgUnitId, out var dorU);
            unitById.TryGetValue(d.DelegateeOrgUnitId, out var deeU);
            return new
            {
                d.Id,
                d.ReferenceNumber,
                DelegationReason = d.DelegationReason ?? "",
                d.DelegatorBeneficiaryId,
                DelegatorName = dor?.FullName ?? "",
                DelegatorRoleDisplay = dor?.RoleDisplayTable ?? "",
                d.DelegatorOrgUnitId,
                DelegatorOrgUnitName = dorU?.Name ?? "",
                d.DelegateeBeneficiaryId,
                DelegateeName = dee?.FullName ?? "",
                DelegateeRoleDisplay = dee?.RoleDisplayTable ?? "",
                d.DelegateeOrgUnitId,
                DelegateeOrgUnitName = deeU?.Name ?? "",
                StartDate = d.StartDate.ToString("yyyy-MM-dd"),
                EndDate = d.EndDate.ToString("yyyy-MM-dd"),
                StatusCode = ComputeDelegationStatus(d),
                CancellationReason = d.CancellationReason ?? "",
                d.CancelledBy,
                CancelledAt = d.CancelledAt?.ToString("yyyy-MM-dd HH:mm"),
                d.CreatedBy,
                CreatedAt = d.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
                d.UpdatedBy,
                UpdatedAt = d.UpdatedAt?.ToString("yyyy-MM-dd HH:mm")
            };
        }).ToList();

        return Json(new { success = true, myBeneficiaryId = me.Id, data });
    }

    [HttpPost]
    public async Task<IActionResult> AddDelegation([FromBody] DelegationRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var err = await ValidateDelegationAsync(req, excludeDelegationId: null);
        if (err != null) return Json(new { success = false, message = err });

        var d = new Delegation
        {
            ReferenceNumber = req.ReferenceNumber,
            DelegationReason = (req.DelegationReason ?? "").Trim(),
            DelegatorBeneficiaryId = req.DelegatorBeneficiaryId,
            DelegatorOrgUnitId = req.DelegatorOrgUnitId,
            DelegateeBeneficiaryId = req.DelegateeBeneficiaryId,
            DelegateeOrgUnitId = req.DelegateeOrgUnitId,
            StartDate = ParseDelegationDate(req.StartDate!),
            EndDate = ParseDelegationDate(req.EndDate!),
            Status = req.SaveAsDraft ? "draft" : "active",
            CreatedBy = CurrentUserFullName
        };
        await _ds.AddDelegationAsync(d);
        await _ds.AddAuditLogAsync(BuildAuditEntry("إضافة تفويض", "Delegation", d.Id.ToString(), ""));
        return Json(new { success = true, message = "تم الحفظ بنجاح", id = d.Id });
    }

    [HttpPost]
    public async Task<IActionResult> UpdateDelegation([FromBody] DelegationUpdateRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var d = await _ds.GetDelegationByIdAsync(req.Id);
        if (d == null) return Json(new { success = false, message = "التفويض غير موجود" });

        if (d.Status == "cancelled")
            return Json(new { success = false, message = "لا يمكن تعديل تفويض ملغي" });

        // دعم إلغاء التفويض مباشرة من واجهة التعديل
        if (req.Cancel)
        {
            var reason = (req.CancellationReason ?? "").Trim();
            if (string.IsNullOrEmpty(reason))
                return Json(new { success = false, message = "سبب إلغاء التفويض مطلوب" });
            var now = DateTime.Now;
            d.Status = "cancelled";
            d.CancellationReason = reason;
            d.CancelledBy = CurrentUserFullName;
            d.CancelledAt = now;
            d.UpdatedBy = CurrentUserFullName;
            d.UpdatedAt = now;
            await _ds.UpdateDelegationAsync(d);
            await _ds.AddAuditLogAsync(BuildAuditEntry("إلغاء تفويض", "Delegation", d.Id.ToString(), reason));
            return Json(new { success = true, message = "تم إلغاء التفويض" });
        }

        if (ComputeDelegationStatus(d) == "expired")
            return Json(new { success = false, message = "لا يمكن تعديل تفويض منتهي" });

        // عند التحديث: لا يُسمح بتاريخ بداية قبل اليوم (يتوافق مع حقل type=date وmin في الواجهة).
        if (!string.IsNullOrWhiteSpace(req.StartDate))
        {
            DateTime newStart;
            try { newStart = ParseDelegationDate(req.StartDate!); } catch { newStart = DateTime.MinValue; }
            if (newStart != DateTime.MinValue && newStart.Date < DateTime.Today)
                return Json(new { success = false, message = "تاريخ البداية لا يمكن أن يكون قبل تاريخ اليوم" });
        }

        var err = await ValidateDelegationAsync(req, excludeDelegationId: req.Id);
        if (err != null) return Json(new { success = false, message = err });

        d.DelegatorBeneficiaryId = req.DelegatorBeneficiaryId;
        d.DelegatorOrgUnitId = req.DelegatorOrgUnitId;
        d.DelegateeBeneficiaryId = req.DelegateeBeneficiaryId;
        d.DelegateeOrgUnitId = req.DelegateeOrgUnitId;
        d.ReferenceNumber = req.ReferenceNumber;
        d.DelegationReason = (req.DelegationReason ?? "").Trim();
        d.StartDate = ParseDelegationDate(req.StartDate!);
        d.EndDate = ParseDelegationDate(req.EndDate!);
        // لو كان مسودة وأراد النشر، ارفع الحالة
        if (!req.SaveAsDraft && d.Status == "draft") d.Status = "active";
        if (req.SaveAsDraft) d.Status = "draft";
        d.UpdatedBy = CurrentUserFullName;
        d.UpdatedAt = DateTime.Now;

        await _ds.UpdateDelegationAsync(d);
        await _ds.AddAuditLogAsync(BuildAuditEntry("تحديث تفويض", "Delegation", d.Id.ToString(), ""));
        return Json(new { success = true, message = "تم التحديث بنجاح" });
    }

    [HttpPost]
    public async Task<IActionResult> DeleteDelegation([FromBody] DelegationDeleteRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var d = await _ds.GetDelegationByIdAsync(req.Id);
        if (d == null) return Json(new { success = false, message = "غير موجود" });

        if (!string.Equals(d.Status?.Trim(), "draft", StringComparison.OrdinalIgnoreCase))
            return Json(new { success = false, message = "يمكن حذف التفويض في حالة المسودة فقط" });

        await _ds.DeleteDelegationAsync(req.Id);
        await _ds.AddAuditLogAsync(BuildAuditEntry("حذف تفويض", "Delegation", req.Id.ToString(), ""));
        return Json(new { success = true, message = "تم الحذف" });
    }

    private async Task<string?> ValidateDelegationAsync(DelegationRequest req, int? excludeDelegationId)
    {
        var reasonTrim = (req.DelegationReason ?? "").Trim();
        if (string.IsNullOrEmpty(reasonTrim)) return "سبب التفويض مطلوب";
        if (req.ReferenceNumber <= 0) return "المرجع مطلوب ويجب أن يكون رقماً صحيحاً أكبر من صفر";

        if (await IsDelegationReferenceDuplicateAsync(req.ReferenceNumber, excludeDelegationId))
            return "المرجع مستخدم في تفويض آخر ولا يُسمح بالتكرار";

        if (req.DelegatorOrgUnitId <= 0) return "الوحدة التنظيمية للمفوض مطلوبة";
        if (req.DelegatorBeneficiaryId <= 0) return "المفوض مطلوب";
        if (req.DelegateeOrgUnitId <= 0) return "الوحدة التنظيمية للمفوض له مطلوبة";
        if (req.DelegateeBeneficiaryId <= 0) return "المفوض له مطلوب";
        if (string.IsNullOrWhiteSpace(req.StartDate)) return "تاريخ بداية التفويض مطلوب";
        if (string.IsNullOrWhiteSpace(req.EndDate)) return "تاريخ نهاية التفويض مطلوب";

        DateTime start, end;
        try { start = ParseDelegationDate(req.StartDate!); } catch { return "تاريخ البداية غير صالح"; }
        try { end = ParseDelegationDate(req.EndDate!); } catch { return "تاريخ النهاية غير صالح"; }
        if (end < start) return "تاريخ النهاية يجب أن يكون أكبر من تاريخ البداية أو يساويه";

        var bens = await _ds.ListBeneficiariesAsync();
        var dor = bens.FirstOrDefault(b => b.Id == req.DelegatorBeneficiaryId);
        var dee = bens.FirstOrDefault(b => b.Id == req.DelegateeBeneficiaryId);
        if (dor == null || !dor.IsActive) return "المفوض غير صالح";
        if (dee == null || !dee.IsActive) return "المفوض له غير صالح";
        if (dor.OrganizationalUnitId != req.DelegatorOrgUnitId)
            return "المفوض لا ينتمي إلى الوحدة التنظيمية المحدّدة";
        if (dee.OrganizationalUnitId != req.DelegateeOrgUnitId)
            return "المفوض له لا ينتمي إلى الوحدة التنظيمية المحدّدة";

        var delegations = await _ds.ListDelegationsAsync();
        var overlapConflict = delegations.Any(d =>
            d.DelegatorBeneficiaryId == req.DelegatorBeneficiaryId &&
            (!excludeDelegationId.HasValue || d.Id != excludeDelegationId.Value) &&
            DelegationCountsTowardDelegatorOverlapConflict(d) &&
            DelegationIntervalsOverlap(start.Date, end.Date, d.StartDate.Date, d.EndDate.Date));

        if (overlapConflict)
            return "هناك تفويض قائم لمستفيد آخر وبالتالي لا يمكنك التفويض، قم بإلغاء التفويض القائم حتى تتمكن من إضافة هذا التفويض";

        return null;
    }

    private async Task<bool> IsDelegationReferenceDuplicateAsync(int referenceNumber, int? excludeDelegationId)
    {
        if (referenceNumber <= 0) return false;
        var delegations = await _ds.ListDelegationsAsync();
        return delegations.Any(d =>
            d.ReferenceNumber == referenceNumber &&
            (!excludeDelegationId.HasValue || d.Id != excludeDelegationId.Value));
    }

    private static bool DelegationIntervalsOverlap(DateTime aStart, DateTime aEnd, DateTime bStart, DateTime bEnd) =>
        aStart <= bEnd && aEnd >= bStart;

    /// <summary>تفويضات المسودة أو الملغاة لا تُعتبر تعارضًا مع تفويض جديد لنفس المفوِّض في نفس الفترة.</summary>
    private static bool DelegationCountsTowardDelegatorOverlapConflict(Delegation d)
    {
        var status = (d.Status ?? "").Trim().ToLowerInvariant();
        return status is not ("cancelled" or "draft");
    }

    private static DateTime ParseDelegationDate(string s)
    {
        // التاريخ يأتي من input[type=date] بصيغة yyyy-MM-dd
        return DateTime.ParseExact(s.Trim(), "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture).Date;
    }

    /// <summary>
    /// القيم: draft / scheduled / active / expired / cancelled.
    /// التخزين يحتفظ بـ draft أو cancelled فقط؛ الباقي يُستنتج من التواريخ.
    /// </summary>
    private static string ComputeDelegationStatus(Delegation d)
    {
        var status = (d.Status ?? "").Trim().ToLowerInvariant();
        if (status == "cancelled") return "cancelled";
        if (status == "draft") return "draft";
        var today = DateTime.Today;
        if (today < d.StartDate.Date) return "scheduled";
        if (today > d.EndDate.Date) return "expired";
        return "active";
    }

    // ─── أنواع الإجراءات (Procedure Action Types) ─────────────────────────────

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
                Color = string.IsNullOrWhiteSpace(r.Color) ? "#25935F" : r.Color,
                Icon = r.Icon ?? "",
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
                Color = string.IsNullOrWhiteSpace(r.Color) ? "#25935F" : r.Color,
                Icon = r.Icon ?? "",
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
            Color = string.IsNullOrWhiteSpace(req.Color) ? "#25935F" : req.Color!.Trim(),
            Icon = string.IsNullOrWhiteSpace(req.Icon) ? "" : req.Icon!.Trim(),
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
        if (!string.IsNullOrWhiteSpace(req.Color)) r.Color = req.Color!.Trim();
        if (req.Icon != null) r.Icon = req.Icon.Trim();
        r.IsActive = req.IsActive;
        r.UpdatedBy = CurrentUserFullName;
        r.UpdatedAt = DateTime.UtcNow;

        await _ds.UpdateProcedureActionTypeAsync(r);
        if (req.SortOrder.HasValue && req.SortOrder.Value > 0 && req.SortOrder.Value != r.SortOrder)
        {
            await _ds.ReorderProcedureActionTypesAsync(r.Id, req.SortOrder.Value);
        }
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

    // ─── دليل المستخدم (User Guide) ───────────────────────────────────────────
    private static string FormatUserGuideDisplayOrder(string? orderPath)
    {
        if (string.IsNullOrWhiteSpace(orderPath)) return "—";
        var parts = orderPath.Split('،', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length == 0) return "—";
        if (parts.Length == 1) return parts[0];
        if (parts.Length == 2) return $"{parts[0]}،{parts[1]}";
        return $"{parts[0]}،{parts[1]}-{string.Join("-", parts.Skip(2))}";
    }

    private static bool IsUserGuideContentEmpty(string? content)
    {
        if (string.IsNullOrWhiteSpace(content)) return true;
        var text = System.Text.RegularExpressions.Regex.Replace(content, "<[^>]+>", " ")
            .Replace("&nbsp;", " ", StringComparison.OrdinalIgnoreCase)
            .Trim();
        if (!string.IsNullOrEmpty(text)) return false;
        return !System.Text.RegularExpressions.Regex.IsMatch(content, @"<(img|iframe|video|table)\b", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
    }

    private static string BuildUserGuideParentPath(UserGuideItem? item, Dictionary<int, UserGuideItem> allById)
    {
        if (item?.ParentId == null) return "";
        var names = new List<string>();
        var curId = item.ParentId;
        var guard = 0;
        while (curId.HasValue && allById.TryGetValue(curId.Value, out var p) && guard++ < 64)
        {
            names.Insert(0, p.Name ?? "");
            curId = p.ParentId;
        }
        return string.Join(" › ", names.Where(n => !string.IsNullOrWhiteSpace(n)));
    }

    private static int BuildUserGuideDepth(UserGuideItem item, Dictionary<int, UserGuideItem> allById)
    {
        var depth = 0;
        var curId = item.ParentId;
        var guard = 0;
        while (curId.HasValue && allById.TryGetValue(curId.Value, out var p) && guard++ < 64)
        {
            depth++;
            curId = p.ParentId;
        }
        return depth;
    }

    private static bool WouldCreateUserGuideCycle(List<UserGuideItem> all, int itemId, int? newParentId)
    {
        if (!newParentId.HasValue || newParentId.Value <= 0) return false;
        if (newParentId.Value == itemId) return true;
        var byId = all.ToDictionary(x => x.Id);
        var cur = newParentId.Value;
        var guard = 0;
        while (cur > 0 && guard++ < 64)
        {
            if (cur == itemId) return true;
            if (!byId.TryGetValue(cur, out var node) || !node.ParentId.HasValue) break;
            cur = node.ParentId.Value;
        }
        return false;
    }

    public IActionResult UserGuide()
    {
        var auth = RequireAuth(); if (auth != null) return auth;
        if (CurrentUserRole != "Admin")
            return RedirectToAction("Index", "Forms");
        SetViewBagUser(_ui);
        ViewBag.PageName = "دليل المستخدم";
        ViewBag.Title = "دليل المستخدم";
        return View("~/Views/Settings/UserGuide.cshtml");
    }

    [HttpGet]
    public async Task<IActionResult> GetUserGuideItems(string? search, string? isActive)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var all = await _ds.ListUserGuideItemsAsync();
        if (all.Any(x => string.IsNullOrWhiteSpace(x.OrderPath)))
            await _ds.RecalculateUserGuideHierarchyAsync();
        all = await _ds.ListUserGuideItemsAsync();
        var allById = all.ToDictionary(x => x.Id);
        var filtered = all.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            filtered = filtered.Where(r => (r.Name ?? "").ToLower().Contains(s));
        }
        if (!string.IsNullOrWhiteSpace(isActive))
            filtered = filtered.Where(r => r.IsActive == (isActive == "1"));

        // قائمة الجذور (للتوافق) + كل العناصر للشجرة
        var roots = all
            .Where(x => !x.ParentId.HasValue)
            .OrderBy(x => x.SortOrder)
            .Select(x => new { id = x.Id, name = x.Name })
            .ToList();

        var data = filtered.Select(r =>
        {
            string parentName = "";
            if (r.ParentId.HasValue && allById.TryGetValue(r.ParentId.Value, out var directParent))
                parentName = directParent.Name ?? "";

            var parentPath = BuildUserGuideParentPath(r, allById);
            var depth = BuildUserGuideDepth(r, allById);
            return new
            {
                r.Id,
                r.ParentId,
                ParentName = parentName,
                ParentPath = parentPath,
                Depth = depth,
                r.Name,
                r.Content,
                r.AttachmentUrl,
                Icon = string.IsNullOrWhiteSpace(r.Icon) ? "" : r.Icon,
                Color = string.IsNullOrWhiteSpace(r.Color) ? "#25935F" : r.Color,
                r.Notes,
                r.SortOrder,
                r.OrderPath,
                DisplayOrder = FormatUserGuideDisplayOrder(r.OrderPath),
                IsRoot = !r.ParentId.HasValue,
                r.IsActive,
                r.CreatedBy,
                CreatedAt = r.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
                r.UpdatedBy,
                UpdatedAt = r.UpdatedAt?.ToString("yyyy-MM-dd HH:mm")
            };
        })
        .OrderBy(x => x.OrderPath, StringComparer.Create(new System.Globalization.CultureInfo("ar-SA"), false))
        .ToList();

        return Json(new { success = true, data, roots, tree = all.Select(x => new { x.Id, x.ParentId, x.Name, x.SortOrder }).ToList() });
    }

    [HttpGet]
    public async Task<IActionResult> GetUserGuideItemDetails(int id)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var r = await _ds.GetUserGuideItemByIdAsync(id);
        if (r == null) return Json(new { success = false, message = "العنصر غير موجود" });

        var all = await _ds.ListUserGuideItemsAsync();
        var allById = all.ToDictionary(x => x.Id);
        string parentName = "";
        if (r.ParentId.HasValue && allById.TryGetValue(r.ParentId.Value, out var p))
            parentName = p.Name ?? "";

        return Json(new
        {
            success = true,
            data = new
            {
                r.Id,
                r.ParentId,
                ParentName = parentName,
                ParentPath = BuildUserGuideParentPath(r, allById),
                r.Name,
                r.Content,
                r.AttachmentUrl,
                Icon = string.IsNullOrWhiteSpace(r.Icon) ? "" : r.Icon,
                Color = string.IsNullOrWhiteSpace(r.Color) ? "#25935F" : r.Color,
                r.Notes,
                r.SortOrder,
                r.OrderPath,
                DisplayOrder = FormatUserGuideDisplayOrder(r.OrderPath),
                IsRoot = !r.ParentId.HasValue,
                r.IsActive,
                r.CreatedBy,
                CreatedAt = r.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
                r.UpdatedBy,
                UpdatedAt = r.UpdatedAt?.ToString("yyyy-MM-dd HH:mm")
            }
        });
    }

    [HttpPost]
    public async Task<IActionResult> AddUserGuideItem([FromBody] UserGuideItemRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });
        if (string.IsNullOrWhiteSpace(req.Name))
            return Json(new { success = false, message = "اسم القائمة/الصفحة مطلوب" });
        if (IsUserGuideContentEmpty(req.Content))
            return Json(new { success = false, message = "المحتوى مطلوب" });

        var trimmedName = req.Name.Trim();
        if (await _ds.IsUserGuideItemNameDuplicateAsync(trimmedName))
            return Json(new { success = false, message = "الاسم موجود مسبقاً" });

        int? parentId = null;
        if (req.ParentId.HasValue && req.ParentId.Value > 0)
        {
            var parent = await _ds.GetUserGuideItemByIdAsync(req.ParentId.Value);
            if (parent == null) return Json(new { success = false, message = "القائمة الرئيسية المختارة غير موجودة" });
            parentId = parent.Id;
        }

        var nextOrder = await _ds.GetNextUserGuideSiblingSortOrderAsync(parentId);
        var row = new UserGuideItem
        {
            ParentId = parentId,
            Name = trimmedName,
            Content = (req.Content ?? "").Trim(),
            SortOrder = nextOrder,
            AttachmentUrl = (req.AttachmentUrl ?? "").Trim(),
            Icon = (req.Icon ?? "").Trim(),
            Color = string.IsNullOrWhiteSpace(req.Color) ? "#25935F" : req.Color!.Trim(),
            Notes = (req.Notes ?? "").Trim(),
            IsActive = req.IsActive,
            CreatedBy = CurrentUserFullName
        };

        await _ds.AddUserGuideItemAsync(row);
        await _ds.AddAuditLogAsync(BuildAuditEntry("إضافة عنصر دليل", "UserGuideItem", row.Id.ToString(), row.Name));
        return Json(new { success = true, message = "تمت الإضافة بنجاح", id = row.Id });
    }

    [HttpPost]
    public async Task<IActionResult> UpdateUserGuideItem([FromBody] UserGuideItemUpdateRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var r = await _ds.GetUserGuideItemByIdAsync(req.Id);
        if (r == null) return Json(new { success = false, message = "العنصر غير موجود" });
        if (string.IsNullOrWhiteSpace(req.Name))
            return Json(new { success = false, message = "اسم القائمة/الصفحة مطلوب" });
        if (IsUserGuideContentEmpty(req.Content))
            return Json(new { success = false, message = "المحتوى مطلوب" });

        var trimmedName = req.Name.Trim();
        if (await _ds.IsUserGuideItemNameDuplicateAsync(trimmedName, req.Id))
            return Json(new { success = false, message = "الاسم موجود مسبقاً" });

        var all = await _ds.ListUserGuideItemsAsync();

        int? parentId = null;
        if (req.ParentId.HasValue && req.ParentId.Value > 0)
        {
            if (req.ParentId.Value == req.Id)
                return Json(new { success = false, message = "لا يمكن أن يكون العنصر أباً لنفسه" });
            var parent = await _ds.GetUserGuideItemByIdAsync(req.ParentId.Value);
            if (parent == null) return Json(new { success = false, message = "القائمة الرئيسية المختارة غير موجودة" });
            if (WouldCreateUserGuideCycle(all, req.Id, parent.Id))
                return Json(new { success = false, message = "لا يمكن اختيار عنصر تابع (مباشرة أو غير مباشرة) كقائمة رئيسية" });
            parentId = parent.Id;
        }

        // إذا كان جذراً وله أبناء — منع تحويله لفرع
        if (r.ParentId == null && parentId.HasValue)
        {
            if (all.Any(x => x.ParentId == r.Id))
                return Json(new { success = false, message = "لا يمكن تحويل قائمة جذر لها عناصر فرعية إلى عنصر تابع. انقل العناصر الفرعية أولاً." });
        }

        // إذا تغيّر الأب — أعد ترتيبه في المستوى الجديد
        var parentChanged = r.ParentId != parentId;
        r.ParentId = parentId;
        r.Name = trimmedName;
        r.Content = (req.Content ?? "").Trim();
        r.AttachmentUrl = (req.AttachmentUrl ?? "").Trim();
        r.Icon = (req.Icon ?? "").Trim();
        if (!string.IsNullOrWhiteSpace(req.Color)) r.Color = req.Color!.Trim();
        r.Notes = (req.Notes ?? "").Trim();
        r.IsActive = req.IsActive;
        r.UpdatedBy = CurrentUserFullName;

        if (parentChanged)
            r.SortOrder = await _ds.GetNextUserGuideSiblingSortOrderAsync(r.ParentId, r.Id);

        await _ds.UpdateUserGuideItemAsync(r);
        await _ds.AddAuditLogAsync(BuildAuditEntry("تحديث عنصر دليل", "UserGuideItem", r.Id.ToString(), r.Name));
        return Json(new { success = true, message = "تم التحديث بنجاح" });
    }

    [HttpPost]
    public async Task<IActionResult> DeleteUserGuideItem([FromBody] UserGuideItemIdRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var r = await _ds.GetUserGuideItemByIdAsync(req.Id);
        if (r == null) return Json(new { success = false, message = "العنصر غير موجود" });

        var blockReason = await _ds.GetUserGuideItemDeleteBlockReasonAsync(req.Id);
        if (blockReason != null)
            return Json(new { success = false, message = blockReason });

        await _ds.DeleteUserGuideItemAsync(req.Id);
        await _ds.AddAuditLogAsync(BuildAuditEntry("حذف عنصر دليل", "UserGuideItem", req.Id.ToString(), r.Name));
        return Json(new { success = true, message = "تم الحذف بنجاح" });
    }

    [HttpPost]
    public async Task<IActionResult> ToggleUserGuideItem([FromBody] UserGuideItemIdRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var r = await _ds.GetUserGuideItemByIdAsync(req.Id);
        if (r == null) return Json(new { success = false, message = "العنصر غير موجود" });

        r.IsActive = !r.IsActive;
        r.UpdatedBy = CurrentUserFullName;
        await _ds.UpdateUserGuideItemAsync(r);
        await _ds.AddAuditLogAsync(BuildAuditEntry(r.IsActive ? "تفعيل عنصر دليل" : "تعطيل عنصر دليل", "UserGuideItem", r.Id.ToString(), r.Name));
        return Json(new { success = true, isActive = r.IsActive });
    }
}

public class UserGuideItemRequest
{
    public int? ParentId { get; set; }
    public string? Name { get; set; }
    public string? Content { get; set; }
    public string? AttachmentUrl { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
}

public class UserGuideItemUpdateRequest : UserGuideItemRequest
{
    public int Id { get; set; }
}

public class UserGuideItemIdRequest
{
    public int Id { get; set; }
}

public class ProcedureActionTypeRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? Color { get; set; }
    public string? Icon { get; set; }
    public bool IsActive { get; set; } = true;
}

public class ProcedureActionTypeUpdateRequest : ProcedureActionTypeRequest
{
    public int Id { get; set; }
    public int? SortOrder { get; set; }
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
    public int? OrganizationalUnitId { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Username { get; set; }
    public bool IsActive { get; set; } = true;
    public string? DeactivateReason { get; set; }
    public bool IsUnitManager { get; set; } = false;
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
    /// <summary>فارغ أو غير محدد = وحدة رئيسية (جذر). غير ذلك = فرع تحت هذه الوحدة.</summary>
    public int? ParentId { get; set; }
    public bool IsActive { get; set; } = true;
}

public class OrgUnitUpdateRequest
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int ClassificationId { get; set; }
    public int? ParentId { get; set; }
    public bool IsActive { get; set; }
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

public class DelegationRequest
{
    public int ReferenceNumber { get; set; }
    public string? DelegationReason { get; set; }
    public int DelegatorBeneficiaryId { get; set; }
    public int DelegatorOrgUnitId { get; set; }
    public int DelegateeBeneficiaryId { get; set; }
    public int DelegateeOrgUnitId { get; set; }
    public string? StartDate { get; set; }
    public string? EndDate { get; set; }
    public bool SaveAsDraft { get; set; }
}

public class DelegationUpdateRequest : DelegationRequest
{
    public int Id { get; set; }

    public bool Cancel { get; set; }

    /// <summary>سبب الإلغاء — إلزامي عند Cancel = true.</summary>
    public string? CancellationReason { get; set; }
}

public class DelegationDeleteRequest
{
    public int Id { get; set; }
}

