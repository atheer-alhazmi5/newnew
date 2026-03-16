using FormsSystem.Models.Entities;
using FormsSystem.Models.Enums;
using FormsSystem.Services;
using Microsoft.AspNetCore.Mvc;

namespace FormsSystem.Controllers;

public class FormBuilderController : BaseController
{
    private readonly DataService _ds;
    private readonly UiHelperService _ui;

    public FormBuilderController(DataService ds, UiHelperService ui) { _ds = ds; _ui = ui; }

    public async Task<IActionResult> Index(int? id)
    {
        var auth = RequireAuth(); if (auth != null) return auth;
        if (CurrentUserRole == "Staff") return RedirectToAction("Index", "Inbox");
        SetViewBagUser(_ui);
        ViewBag.EditFormId = id;

        var categories = await _ds.ListCategoriesAsync();
        var departments = await _ds.ListDepartmentsAsync();
        var users = await _ds.ListUsersAsync();

        var jsonOpts = new System.Text.Json.JsonSerializerOptions
        {
            PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase
        };
        ViewBag.CategoriesJson = System.Text.Json.JsonSerializer.Serialize(
            categories.Select(c => new { c.Id, c.Name }), jsonOpts);
        ViewBag.DepartmentsJson = System.Text.Json.JsonSerializer.Serialize(
            departments.Select(d => new { d.Id, d.Name }), jsonOpts);
        ViewBag.UsersJson = System.Text.Json.JsonSerializer.Serialize(
            users.Where(u => u.Id != CurrentUserId)
                 .Select(u => new { u.Id, u.FullName, DeptName = u.Department?.Name ?? "", u.DepartmentId, u.RoleLabel }), jsonOpts);

        return View();
    }

    [HttpPost]
    public async Task<IActionResult> Save([FromBody] SaveFormRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole == "Staff")
            return Json(new { success = false, message = "غير مصرح" });

        if (string.IsNullOrWhiteSpace(req.Name))
            return Json(new { success = false, message = "عنوان النموذج مطلوب" });

        if (string.IsNullOrWhiteSpace(req.Category))
            return Json(new { success = false, message = "التصنيف مطلوب" });

        bool pinAsReady = req.PinAsReady && CurrentUserRole == "Admin";

        if (req.Id > 0)
        {
            var existing = await _ds.GetFormByIdAsync(req.Id);
            if (existing == null) return Json(new { success = false, message = "النموذج غير موجود" });

            existing.Name = req.Name;
            existing.Description = req.Description ?? "";
            existing.Icon = req.Icon ?? "document";
            existing.Category = req.Category ?? "";
            existing.SectionsJson = req.SectionsJson ?? "[]";
            existing.StartDate = req.StartDate;
            existing.EndDate = req.EndDate;
            existing.PinAsReady = pinAsReady;
            if (pinAsReady) existing.Type = "ready_made";
            await _ds.UpdateFormAsync(existing);
            return Json(new { success = true, id = existing.Id, message = "تم الحفظ بنجاح" });
        }

        var form = new Form
        {
            Name = req.Name,
            Description = req.Description ?? "",
            Icon = req.Icon ?? "document",
            Type = pinAsReady ? "ready_made" : "published",
            Category = req.Category ?? "",
            SectionsJson = req.SectionsJson ?? "[]",
            CreatedBy = CurrentUserFullName,
            CreatedByDepartment = CurrentDeptName,
            CreatedByUserId = CurrentUserId,
            StartDate = req.StartDate,
            EndDate = req.EndDate,
            PinAsReady = pinAsReady
        };
        var saved = await _ds.AddFormAsync(form);

        await _ds.AddAuditLogAsync(CurrentUserId, CurrentUserFullName,
            pinAsReady ? "تثبيت نموذج جاهز" : "إنشاء نموذج", "Form",
            saved.Id.ToString(), req.Name);

        return Json(new { success = true, id = saved.Id, message = "تم إنشاء النموذج بنجاح", pinAsReady });
    }

    [HttpPost]
    public async Task<IActionResult> Publish([FromBody] PublishFormRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole == "Staff")
            return Json(new { success = false, message = "غير مصرح" });

        if (string.IsNullOrWhiteSpace(req.Name))
            return Json(new { success = false, message = "عنوان النموذج مطلوب" });

        bool pinAsReady = req.PinAsReady && CurrentUserRole == "Admin";

        var form = new Form
        {
            Name = req.Name,
            Description = req.Description ?? "",
            Icon = req.Icon ?? "document",
            Type = pinAsReady ? "ready_made" : "published",
            Category = req.Category ?? "",
            SectionsJson = req.SectionsJson ?? "[]",
            CreatedBy = CurrentUserFullName,
            CreatedByDepartment = CurrentDeptName,
            CreatedByUserId = CurrentUserId,
            StartDate = req.StartDate,
            EndDate = req.EndDate,
            PinAsReady = pinAsReady
        };

        if (req.EditId > 0)
        {
            var existing = await _ds.GetFormByIdAsync(req.EditId);
            if (existing != null)
            {
                existing.Name = form.Name;
                existing.Description = form.Description;
                existing.Icon = form.Icon;
                existing.Type = form.Type;
                existing.Category = form.Category;
                existing.SectionsJson = form.SectionsJson;
                existing.StartDate = form.StartDate;
                existing.EndDate = form.EndDate;
                existing.PinAsReady = form.PinAsReady;
                await _ds.UpdateFormAsync(existing);
                form = existing;
            }
            else
            {
                form = await _ds.AddFormAsync(form);
            }
        }
        else
        {
            form = await _ds.AddFormAsync(form);
        }

        if (pinAsReady)
        {
            await _ds.AddAuditLogAsync(CurrentUserId, CurrentUserFullName,
                "تثبيت نموذج جاهز", "Form", form.Id.ToString(), req.Name);
            return Json(new { success = true, message = "تم تثبيت النموذج كنموذج جاهز", redirect = "/Forms/Index" });
        }

        var allUsers = await _ds.ListUsersAsync();
        var targetUserIds = req.TargetUserIds ?? new List<int>();
        var targetDeptIds = req.TargetDepartmentIds ?? new List<int>();

        if (targetDeptIds.Any())
        {
            var deptUsers = allUsers.Where(u => targetDeptIds.Contains(u.DepartmentId) && u.Id != CurrentUserId)
                                    .Select(u => u.Id);
            targetUserIds = targetUserIds.Union(deptUsers).Distinct().ToList();
        }

        var recipients = allUsers.Where(u => targetUserIds.Contains(u.Id)).ToList();

        if (CurrentUserRole == "Employee")
        {
            var managers = allUsers.Where(u => u.Role == UserRole.Manager && u.DepartmentId == CurrentDeptId).ToList();
            if (!managers.Any())
                return Json(new { success = false, message = "لا يوجد مدير وحدة تنظيمية في قسمك" });

            var sentToJson = System.Text.Json.JsonSerializer.Serialize(
                recipients.Select(r => new { r.Id, r.FullName, DeptName = r.Department?.Name }));
            var sf = await _ds.AddSentFormAsync(new SentForm
            {
                FormId = form.Id, FormName = form.Name, FormIcon = form.Icon,
                SenderId = CurrentUserId, SenderName = CurrentUserFullName,
                SenderDepartment = CurrentDeptName, SentToJson = sentToJson,
                StartDate = req.StartDate, EndDate = req.EndDate,
                Status = "pending_approval"
            });

            foreach (var mgr in managers)
            {
                await _ds.AddReceivedFormAsync(new ReceivedForm
                {
                    FormId = form.Id, FormName = form.Name, FormIcon = form.Icon,
                    SenderId = CurrentUserId, SenderName = CurrentUserFullName,
                    SenderDepartment = CurrentDeptName,
                    RecipientId = mgr.Id, RecipientName = mgr.FullName,
                    Category = "approval_request",
                    SentFormId = sf.Id,
                    TargetRecipientsJson = sentToJson
                });
                await _ds.CreateNotificationAsync(new Notification
                {
                    FormId = form.Id, FormName = form.Name,
                    RecipientId = mgr.Id, Type = "approval_request",
                    Title = $"طلب اعتماد: {form.Name}",
                    Message = $"طلب {CurrentUserFullName} اعتماد نموذج ({form.Name})",
                    SenderName = CurrentUserFullName, SenderDepartment = CurrentDeptName
                });
            }

            await _ds.AddAuditLogAsync(CurrentUserId, CurrentUserFullName,
                "إرسال نموذج للاعتماد", "Form", form.Id.ToString(), req.Name);
            return Json(new { success = true, message = "تم إرسال النموذج للاعتماد", redirect = "/Outbox/Index" });
        }

        var sentToJsonDirect = System.Text.Json.JsonSerializer.Serialize(
            recipients.Select(r => new { r.Id, r.FullName, DeptName = r.Department?.Name }));
        var sfDirect = await _ds.AddSentFormAsync(new SentForm
        {
            FormId = form.Id, FormName = form.Name, FormIcon = form.Icon,
            SenderId = CurrentUserId, SenderName = CurrentUserFullName,
            SenderDepartment = CurrentDeptName, SentToJson = sentToJsonDirect,
            StartDate = req.StartDate, EndDate = req.EndDate,
            Status = "published"
        });

        foreach (var r in recipients)
        {
            await _ds.AddReceivedFormAsync(new ReceivedForm
            {
                FormId = form.Id, FormName = form.Name, FormIcon = form.Icon,
                SenderId = CurrentUserId, SenderName = CurrentUserFullName,
                SenderDepartment = CurrentDeptName,
                RecipientId = r.Id, RecipientName = r.FullName,
                Category = "fill_request", SentFormId = sfDirect.Id
            });
            await _ds.CreateNotificationAsync(new Notification
            {
                FormId = form.Id, FormName = form.Name,
                RecipientId = r.Id, Type = "fill_request",
                Title = $"نموذج جديد: {form.Name}",
                Message = $"أرسل إليك {CurrentUserFullName} نموذج ({form.Name}) للتعبئة",
                SenderName = CurrentUserFullName, SenderDepartment = CurrentDeptName
            });
        }

        await _ds.AddAuditLogAsync(CurrentUserId, CurrentUserFullName,
            "نشر نموذج", "Form", form.Id.ToString(), $"إلى {recipients.Count} مستلم");
        return Json(new { success = true, message = "تم نشر النموذج بنجاح!", redirect = "/Outbox/Index" });
    }

    [HttpGet]
    public async Task<IActionResult> GetForm(int id)
    {
        if (!IsAuthenticated) return Json(new { success = false });
        var f = await _ds.GetFormByIdAsync(id);
        if (f == null) return Json(new { success = false });
        return Json(new
        {
            success = true,
            data = new { f.Id, f.Name, f.Description, f.Icon, f.Category, f.SectionsJson, f.StartDate, f.EndDate, f.PinAsReady }
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetCategories()
    {
        if (!IsAuthenticated) return Json(new { success = false });
        var cats = await _ds.ListCategoriesAsync();
        return Json(new { success = true, data = cats.Select(c => new { c.Id, c.Name }) });
    }

    [HttpPost]
    public async Task<IActionResult> AddCategory([FromBody] AddCategoryRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        if (string.IsNullOrWhiteSpace(req.Name))
            return Json(new { success = false, message = "اسم التصنيف مطلوب" });

        var cat = await _ds.AddCategoryAsync(new FormCategory { Name = req.Name.Trim() });
        return Json(new { success = true, data = new { cat.Id, cat.Name }, message = "تم إضافة التصنيف" });
    }

    [HttpPost]
    public async Task<IActionResult> DeleteCategory([FromBody] DeleteCategoryRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var deleted = await _ds.DeleteCategoryAsync(req.Id);
        if (!deleted) return Json(new { success = false, message = "التصنيف غير موجود" });
        return Json(new { success = true, message = "تم حذف التصنيف" });
    }
}

public class SaveFormRequest
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public string? Category { get; set; }
    public string? SectionsJson { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public bool PinAsReady { get; set; }
}

public class PublishFormRequest
{
    public int EditId { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public string? Category { get; set; }
    public string? SectionsJson { get; set; }
    public bool PinAsReady { get; set; }
    public List<int>? TargetDepartmentIds { get; set; }
    public List<int>? TargetUserIds { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
}

public class AddCategoryRequest
{
    public string Name { get; set; } = "";
}

public class DeleteCategoryRequest
{
    public int Id { get; set; }
}
