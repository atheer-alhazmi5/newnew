using FormsSystem.Models.Entities;
using FormsSystem.Services;
using Microsoft.AspNetCore.Mvc;

namespace FormsSystem.Controllers;

public class SettingsController : BaseController
{
    private readonly DataService _ds;
    private readonly UiHelperService _ui;
    private readonly PasswordService _pw;

    public SettingsController(DataService ds, UiHelperService ui, PasswordService pw)
    { _ds = ds; _ui = ui; _pw = pw; }

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
        await _ds.AddAuditLogAsync(CurrentUserId, CurrentUserFullName,
            "إضافة تصنيف", "Classification", cls.Id.ToString(), cls.Name);

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

        await _ds.AddAuditLogAsync(CurrentUserId, CurrentUserFullName,
            "تحديث تصنيف", "Classification", cls.Id.ToString(), cls.Name);

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

        await _ds.AddAuditLogAsync(CurrentUserId, CurrentUserFullName,
            "حذف تصنيف", "Classification", req.Id.ToString(), cls.Name);

        return Json(new { success = true, message = "تم حذف التصنيف بنجاح" });
    }

    // ─── ORGANIZATIONAL UNITS API ─────────────────────────────────────────────

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
        await _ds.AddAuditLogAsync(CurrentUserId, CurrentUserFullName,
            "إضافة وحدة تنظيمية", "OrganizationalUnit", unit.Id.ToString(), unit.Name);

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

        await _ds.AddAuditLogAsync(CurrentUserId, CurrentUserFullName,
            "تحديث وحدة تنظيمية", "OrganizationalUnit", unit.Id.ToString(), unit.Name);

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

        await _ds.AddAuditLogAsync(CurrentUserId, CurrentUserFullName,
            "حذف وحدة تنظيمية", "OrganizationalUnit", req.Id.ToString(), unit.Name);

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
                b.IsActive,
                b.MainRole,
                b.SubRole
            }),
            organizationalUnits = units.Select(u => new { u.Id, u.Name }).ToList()
        });
    }

    [HttpPost]
    public async Task<IActionResult> AddBeneficiary([FromBody] BeneficiaryRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var err = ValidateBeneficiary(req, isAdd: true);
        if (err != null) return Json(new { success = false, message = err });

        var existing = await _ds.GetBeneficiaryByNationalIdAsync(req.NationalId!.Trim());
        if (existing != null)
            return Json(new { success = false, message = "الهوية الوطنية مسجلة مسبقاً" });

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
            IsActive = req.IsActive,
            MainRole = req.MainRole ?? "موظف",
            SubRole = req.SubRole ?? "",
            PasswordHash = !string.IsNullOrEmpty(req.Password) ? _pw.Hash(req.Password) : ""
        };

        await _ds.AddBeneficiaryAsync(b);
        await _ds.AddAuditLogAsync(CurrentUserId, CurrentUserFullName, "إضافة مستفيد", "Beneficiary", b.Id.ToString(), b.FullName);
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

        var existing = await _ds.GetBeneficiaryByNationalIdAsync(req.NationalId!.Trim(), req.Id);
        if (existing != null)
            return Json(new { success = false, message = "الهوية الوطنية مسجلة مسبقاً" });

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
        b.IsActive = req.IsActive;
        b.MainRole = req.MainRole ?? b.MainRole;
        b.SubRole = req.SubRole ?? "";
        b.UpdatedAt = DateTime.Now;
        if (!string.IsNullOrEmpty(req.Password))
            b.PasswordHash = _pw.Hash(req.Password);

        await _ds.UpdateBeneficiaryAsync(b);
        await _ds.AddAuditLogAsync(CurrentUserId, CurrentUserFullName, "تحديث مستفيد", "Beneficiary", b.Id.ToString(), b.FullName);
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
        await _ds.AddAuditLogAsync(CurrentUserId, CurrentUserFullName, "حذف مستفيد", "Beneficiary", req.Id.ToString(), b.FullName);
        return Json(new { success = true, message = "تم حذف المستفيد بنجاح" });
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
        if (!System.Text.RegularExpressions.Regex.IsMatch(email, @"^[^\s@]+@gov\.sa$", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
            return "يجب إدخال بريد إلكتروني رسمي بصيغة xxxxx@gov.sa";

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

