using System.Text.Json;
using FormsSystem.Models.Entities;
using FormsSystem.Services;
using Microsoft.AspNetCore.Mvc;

namespace FormsSystem.Controllers;

public class SupportController : BaseController
{
    private readonly DataService _ds;
    private readonly UiHelperService _ui;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    public SupportController(DataService ds, UiHelperService ui)
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
        ViewBag.PageName = "الدعم الفني";
        ViewBag.Title = "الدعم الفني";
        return View();
    }

    [HttpGet]
    public async Task<IActionResult> GetTickets()
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });

        var isAdmin = CurrentUserRole == "Admin";
        var all = await _ds.ListSupportTicketsAsync();
        var visible = isAdmin ? all : all.Where(t => t.SubmittedById == CurrentUserId).ToList();

        var orgUnits = await _ds.ListActiveOrganizationalUnitsAsync();
        orgUnits = orgUnits.OrderBy(u => u.SortOrder).ThenBy(u => u.Name).ToList();

        return Json(new
        {
            success = true,
            isAdmin,
            categories = DataService.SupportCategories,
            importanceLevels = DataService.SupportImportanceLevels,
            statusValues = DataService.SupportStatusValues,
            organizationalUnits = orgUnits.Select(u => new { u.Id, u.Name, u.ParentId, u.SortOrder }),
            data = visible.OrderByDescending(t => t.CreatedAt).Select(MapTicket)
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetTicket(int id)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        var t = await _ds.GetSupportTicketByIdAsync(id);
        if (t == null) return Json(new { success = false, message = "غير موجود" });
        if (!CanAccess(t)) return Json(new { success = false, message = "غير مصرح" });
        return Json(new { success = true, data = MapTicket(t) });
    }

    [HttpPost]
    public async Task<IActionResult> CreateTicket([FromBody] SupportTicketCreateRequest req)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });

        var err = ValidateCreate(req);
        if (err != null) return Json(new { success = false, message = err });

        var user = await _ds.GetUserByIdAsync(CurrentUserId);
        if (user == null) return Json(new { success = false, message = "تعذّر تحديد المستخدم" });

        var depts = await _ds.ListDepartmentsAsync();
        var orgUnits = await _ds.ListOrganizationalUnitsAsync();
        var ouName = ResolveUnitDisplayName(user.DepartmentId, depts, orgUnits);
        if (string.IsNullOrEmpty(ouName)) ouName = CurrentDeptName;

        var ticket = new SupportTicket
        {
            RequestNumber = await _ds.GenerateSupportTicketNumberAsync(),
            SubmittedById = CurrentUserId,
            SubmitterName = user.FullName,
            OrganizationalUnitId = user.DepartmentId,
            OrganizationalUnitName = ouName,
            Category = DataService.NormalizeSupportCategory(req.Category),
            Importance = DataService.NormalizeSupportImportance(req.Importance),
            Subject = req.Subject!.Trim(),
            Content = (req.Content ?? "").Trim(),
            AttachmentsJson = SerializeAttachments(req.Attachments),
            Status = "مفتوح",
            CreatedAt = DateTime.UtcNow
        };

        await _ds.AddSupportTicketAsync(ticket);
        await _ds.AddAuditLogAsync(BuildAuditEntry("تقديم طلب دعم فني", "SupportTicket", ticket.Id.ToString(), ticket.RequestNumber));
        return Json(new { success = true, message = "تم تقديم الطلب بنجاح", data = MapTicket(ticket) });
    }

    [HttpPost]
    public async Task<IActionResult> UpdateTicket([FromBody] SupportTicketUpdateRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var t = await _ds.GetSupportTicketByIdAsync(req.Id);
        if (t == null) return Json(new { success = false, message = "غير موجود" });
        if (t.Status == "مغلق")
            return Json(new { success = false, message = "لا يمكن تحديث طلب مغلق" });

        var response = (req.Response ?? "").Trim();
        if (string.IsNullOrEmpty(response))
            return Json(new { success = false, message = "الرد مطلوب" });

        t.Response = response;
        t.Status = "مغلق";
        t.RespondedById = CurrentUserId;
        t.RespondedByName = CurrentUserFullName;

        await _ds.UpdateSupportTicketAsync(t);
        await _ds.AddAuditLogAsync(BuildAuditEntry("تحديث طلب دعم فني", "SupportTicket", t.Id.ToString(), t.RequestNumber));
        return Json(new { success = true, message = "تم إغلاق الطلب وإرسال الرد", data = MapTicket(t) });
    }

    [HttpPost]
    public async Task<IActionResult> DeleteTicket([FromBody] SupportTicketIdRequest req)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        var t = await _ds.GetSupportTicketByIdAsync(req.Id);
        if (t == null) return Json(new { success = false, message = "غير موجود" });
        if (t.Status == "مغلق")
            return Json(new { success = false, message = "لا يمكن حذف طلب مغلق" });
        if (!CanDelete(t))
            return Json(new { success = false, message = "غير مصرح" });

        await _ds.DeleteSupportTicketAsync(req.Id);
        await _ds.AddAuditLogAsync(BuildAuditEntry("حذف طلب دعم فني", "SupportTicket", req.Id.ToString(), t.RequestNumber));
        return Json(new { success = true, message = "تم حذف الطلب" });
    }

    [HttpPost]
    public async Task<IActionResult> UploadAttachment(IFormFile file)
    {
        if (!IsAuthenticated) return Json(new { success = false, message = "غير مصرح" });
        if (file == null || file.Length == 0)
            return Json(new { success = false, message = "لم يتم اختيار ملف" });

        var allowed = new[]
        {
            "image/jpeg", "image/png", "image/gif", "image/webp",
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "text/plain"
        };
        var ct = file.ContentType.ToLower();
        if (!allowed.Contains(ct))
            return Json(new { success = false, message = "نوع الملف غير مدعوم" });
        if (file.Length > 10_000_000)
            return Json(new { success = false, message = "حجم الملف يتجاوز 10 MB" });

        var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "support");
        Directory.CreateDirectory(uploadsDir);
        var ext = Path.GetExtension(file.FileName);
        var fileName = $"{Guid.NewGuid()}{ext}";
        var filePath = Path.Combine(uploadsDir, fileName);
        using (var stream = System.IO.File.Create(filePath))
            await file.CopyToAsync(stream);

        return Json(new
        {
            success = true,
            url = $"/uploads/support/{fileName}",
            name = file.FileName
        });
    }

    private bool CanAccess(SupportTicket t)
        => CurrentUserRole == "Admin" || t.SubmittedById == CurrentUserId;

    private bool CanDelete(SupportTicket t)
        => CurrentUserRole != "Admin" && t.SubmittedById == CurrentUserId;

    private static string? ValidateCreate(SupportTicketCreateRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Subject)) return "الموضوع مطلوب";
        if (string.IsNullOrWhiteSpace(req.Content)) return "المحتوى مطلوب";
        if (string.IsNullOrEmpty(DataService.NormalizeSupportCategory(req.Category)))
            return "التصنيف مطلوب";
        return null;
    }

    private static string SerializeAttachments(List<SupportAttachmentDto>? items)
    {
        if (items == null || items.Count == 0) return "[]";
        return JsonSerializer.Serialize(items.Where(a => !string.IsNullOrWhiteSpace(a.Url)), JsonOpts);
    }

    private static List<SupportAttachmentDto> ParseAttachments(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new();
        try
        {
            return JsonSerializer.Deserialize<List<SupportAttachmentDto>>(json, JsonOpts) ?? new();
        }
        catch { return new(); }
    }

    private object MapTicket(SupportTicket t) => new
    {
        t.Id,
        t.RequestNumber,
        t.SubmittedById,
        t.SubmitterName,
        t.OrganizationalUnitId,
        t.OrganizationalUnitName,
        t.Category,
        t.Importance,
        t.Subject,
        t.Content,
        Attachments = ParseAttachments(t.AttachmentsJson),
        t.Status,
        t.Response,
        t.RespondedById,
        t.RespondedByName,
        CreatedAt = t.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
        UpdatedAt = (t.UpdatedAt ?? t.CreatedAt).ToString("yyyy-MM-dd HH:mm")
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

public class SupportAttachmentDto
{
    public string Name { get; set; } = "";
    public string Url { get; set; } = "";
}

public class SupportTicketCreateRequest
{
    public string? Category { get; set; }
    public string? Importance { get; set; }
    public string? Subject { get; set; }
    public string? Content { get; set; }
    public List<SupportAttachmentDto>? Attachments { get; set; }
}

public class SupportTicketUpdateRequest
{
    public int Id { get; set; }
    public string? Response { get; set; }
    public string? Status { get; set; }
}

public class SupportTicketIdRequest
{
    public int Id { get; set; }
}
