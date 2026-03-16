using FormsSystem.Models.Entities;
using FormsSystem.Services;
using Microsoft.AspNetCore.Mvc;

namespace FormsSystem.Controllers;

public class FormsController : BaseController
{
    private readonly DataService _ds;
    private readonly UiHelperService _ui;

    public FormsController(DataService ds, UiHelperService ui) { _ds = ds; _ui = ui; }

    public IActionResult Index()
    {
        var auth = RequireAuth(); if (auth != null) return auth;
        SetViewBagUser(_ui);
        return View();
    }

    [HttpGet]
    public async Task<IActionResult> GetForms(string? search, string? category)
    {
        if (!IsAuthenticated) return Json(new { success = false });
        var forms = await _ds.ListReadyFormsAsync();

        if (!string.IsNullOrEmpty(search))
            forms = forms.Where(f => (f.Name ?? "").Contains(search, StringComparison.OrdinalIgnoreCase)).ToList();
        if (!string.IsNullOrEmpty(category))
            forms = forms.Where(f => f.Category == category).ToList();

        var cats = await _ds.ListCategoriesAsync();
        return Json(new
        {
            success = true,
            data = forms.Select(f => new
            {
                f.Id, f.Name, f.Description, f.Icon, f.Type,
                f.Category, f.CategoryId, f.CreatedBy, f.CreatedByDepartment,
                f.CreatedAt, f.PinAsReady, f.SectionsJson
            }),
            categories = cats.Select(c => new { c.Id, c.Name })
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetForm(int id)
    {
        if (!IsAuthenticated) return Json(new { success = false });
        var f = await _ds.GetFormByIdAsync(id);
        if (f == null) return Json(new { success = false, message = "النموذج غير موجود" });
        return Json(new
        {
            success = true,
            data = new
            {
                f.Id, f.Name, f.Description, f.Icon, f.Type,
                f.Category, f.CategoryId, f.CreatedBy, f.CreatedByDepartment,
                f.SectionsJson, f.StartDate, f.EndDate, f.PinAsReady
            }
        });
    }

    [HttpPost]
    public async Task<IActionResult> SendForm([FromBody] SendFormRequest req)
    {
        if (!IsAuthenticated) return Json(new { success = false });
        if (CurrentUserRole == "Staff") return Json(new { success = false, message = "غير مصرح" });

        var form = await _ds.GetFormByIdAsync(req.FormId);
        if (form == null) return Json(new { success = false, message = "النموذج غير موجود" });

        var users = await _ds.ListUsersAsync();
        var recipients = users.Where(u => req.RecipientIds.Contains(u.Id)).ToList();
        if (!recipients.Any()) return Json(new { success = false, message = "يجب اختيار مستلم واحد على الأقل" });

        var sentToJson = System.Text.Json.JsonSerializer.Serialize(
            recipients.Select(r => new { r.Id, r.FullName, r.Department?.Name }));

        bool isEmployee = CurrentUserRole == "Employee";

        var sf = await _ds.AddSentFormAsync(new SentForm
        {
            FormId = form.Id, FormName = form.Name, FormIcon = form.Icon,
            SenderId = CurrentUserId, SenderName = CurrentUserFullName,
            SenderDepartment = CurrentDeptName,
            SentToJson = sentToJson,
            StartDate = req.StartDate, EndDate = req.EndDate,
            Status = isEmployee ? "pending_approval" : "published"
        });

        if (isEmployee)
        {
            var managers = users.Where(u => u.Role == Models.Enums.UserRole.Manager &&
                                            u.DepartmentId == CurrentDeptId).ToList();
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
        }
        else
        {
            foreach (var r in recipients)
            {
                await _ds.AddReceivedFormAsync(new ReceivedForm
                {
                    FormId = form.Id, FormName = form.Name, FormIcon = form.Icon,
                    SenderId = CurrentUserId, SenderName = CurrentUserFullName,
                    SenderDepartment = CurrentDeptName,
                    RecipientId = r.Id, RecipientName = r.FullName,
                    Category = "fill_request", SentFormId = sf.Id
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
        }

        await _ds.AddAuditLogAsync(CurrentUserId, CurrentUserFullName, "إرسال نموذج", "Form",
            form.Id.ToString(), $"إلى {recipients.Count} مستلم");

        return Json(new { success = true, message = "تم الإرسال بنجاح" });
    }

    [HttpGet]
    public async Task<IActionResult> GetUsers()
    {
        if (!IsAuthenticated) return Json(new { success = false });
        var users = await _ds.ListUsersAsync();
        return Json(new
        {
            success = true,
            data = users.Where(u => u.Id != CurrentUserId)
                .Select(u => new { u.Id, u.FullName, u.RoleLabel, DeptName = u.Department?.Name })
        });
    }

    [HttpDelete]
    public async Task<IActionResult> Delete(int id)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });
        await _ds.DeleteFormAsync(id);
        return Json(new { success = true });
    }
}

public class SendFormRequest
{
    public int FormId { get; set; }
    public List<int> RecipientIds { get; set; } = new();
    public string? Category { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
}
