using FormsSystem.Models.Entities;
using FormsSystem.Services;
using Microsoft.AspNetCore.Mvc;

namespace FormsSystem.Controllers;

public class DropdownsController : BaseController
{
    private readonly DataService _ds;
    private readonly UiHelperService _ui;

    public DropdownsController(DataService ds, UiHelperService ui)
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
        ViewBag.PageName = "القوائم المنسدلة";
        return View();
    }

    [HttpGet]
    public async Task<IActionResult> GetDropdownLists(string? search, string? listType, string? selectionType, string? ownership, int? orgUnitId)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var lists = await _ds.ListDropdownListsAsync();
        var units = await _ds.ListOrganizationalUnitsAsync();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            lists = lists.Where(l => (l.Name?.ToLower().Contains(s) ?? false) || (l.Description?.ToLower().Contains(s) ?? false)).ToList();
        }
        if (!string.IsNullOrWhiteSpace(listType))
            lists = lists.Where(l => l.ListType == listType).ToList();
        if (!string.IsNullOrWhiteSpace(selectionType))
            lists = lists.Where(l => l.SelectionType == selectionType).ToList();
        if (!string.IsNullOrWhiteSpace(ownership))
            lists = lists.Where(l => l.Ownership == ownership).ToList();
        if (orgUnitId.HasValue && orgUnitId.Value > 0)
            lists = lists.Where(l => l.OrganizationalUnitId == orgUnitId.Value).ToList();

        var result = lists.Select(l => new
        {
            l.Id,
            l.Name,
            l.Description,
            l.SortOrder,
            l.ListType,
            l.SelectionType,
            l.Ownership,
            l.OrganizationalUnitId,
            OrganizationalUnitName = units.FirstOrDefault(u => u.Id == l.OrganizationalUnitId)?.Name ?? "",
            l.IsActive,
            l.ParentListId,
            l.LevelCount,
            l.LevelNamesJson,
            l.CreatedBy,
            CreatedAt = l.CreatedAt.ToString("yyyy-MM-dd")
        }).OrderBy(x => x.SortOrder).ToList();

        return Json(new { success = true, data = result, organizationalUnits = units.Select(u => new { u.Id, u.Name }).ToList(), currentUser = CurrentUserFullName });
    }

    [HttpGet]
    public async Task<IActionResult> GetIndependentLists()
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });
        var lists = await _ds.ListIndependentDropdownListsAsync();
        return Json(new { success = true, data = lists.Select(l => new { l.Id, l.Name }).ToList() });
    }

    [HttpGet]
    public async Task<IActionResult> GetDropdownListDetails(int id)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var list = await _ds.GetDropdownListByIdAsync(id);
        if (list == null)
            return Json(new { success = false, message = "القائمة غير موجودة" });

        var units = await _ds.ListOrganizationalUnitsAsync();
        var parentList = list.ParentListId.HasValue ? await _ds.GetDropdownListByIdAsync(list.ParentListId.Value) : null;
        var items = await _ds.ListDropdownItemsByListIdAsync(id);

        return Json(new
        {
            success = true,
            data = new
            {
                list.Id,
                list.Name,
                list.Description,
                list.SortOrder,
                list.ListType,
                list.SelectionType,
                list.Ownership,
                list.OrganizationalUnitId,
                OrganizationalUnitName = units.FirstOrDefault(u => u.Id == list.OrganizationalUnitId)?.Name ?? "",
                list.IsActive,
                list.ParentListId,
                ParentListName = parentList?.Name ?? "",
                list.LevelCount,
                list.LevelNamesJson,
                Items = items.Select(i => new { i.Id, i.ItemText, i.Description, i.Color, i.IsActive, i.SortOrder, i.ParentItemId, i.LevelNumber, i.LevelValuesJson })
            }
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetDropdownItems(int listId)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var list = await _ds.GetDropdownListByIdAsync(listId);
        var items = await _ds.ListDropdownItemsByListIdAsync(listId);

        var parentItems = new List<DropdownItem>();
        if (list?.ListType == "قائمة فرعية" && list.ParentListId.HasValue)
            parentItems = await _ds.ListDropdownItemsByListIdAsync(list.ParentListId.Value);

        var result = items.Select(i => new
        {
            i.Id,
            i.DropdownListId,
            i.ItemText,
            i.Description,
            i.Color,
            i.IsActive,
            i.SortOrder,
            i.ParentItemId,
            i.LevelNumber,
            i.LevelValuesJson,
            ParentItemText = i.ParentItemId.HasValue
                ? parentItems.FirstOrDefault(p => p.Id == i.ParentItemId.Value)?.ItemText ?? ""
                : ""
        }).ToList();

        return Json(new { success = true, data = result });
    }

    private async Task<int> GetCreatorOrgUnitIdAsync()
    {
        var user = await _ds.GetUserByIdAsync(CurrentUserId);
        if (user != null && !string.IsNullOrEmpty(user.Email))
        {
            var beneficiary = await _ds.GetBeneficiaryByEmailAsync(user.Email);
            if (beneficiary != null)
                return beneficiary.OrganizationalUnitId;
        }
        var units = await _ds.ListOrganizationalUnitsAsync();
        return units.Count > 0 ? units.First().Id : 0;
    }

    [HttpPost]
    public async Task<IActionResult> AddDropdownList([FromBody] DropdownListRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        if (string.IsNullOrWhiteSpace(req.Name))
            return Json(new { success = false, message = "اسم القائمة المنسدلة مطلوب" });

        if (string.IsNullOrWhiteSpace(req.Ownership) || (req.Ownership != "عام" && req.Ownership != "خاص"))
            return Json(new { success = false, message = "الملكية مطلوبة (عام أو خاص)" });

        if (string.IsNullOrWhiteSpace(req.ListType))
            return Json(new { success = false, message = "نوع القائمة المنسدلة مطلوب" });
        if (req.ListType != "قائمة مستقلة" && req.ListType != "قائمة فرعية" && req.ListType != "قائمة هرمية")
            return Json(new { success = false, message = "نوع القائمة يجب أن يكون: قائمة مستقلة، قائمة فرعية، أو قائمة هرمية" });

        if (req.ListType == "قائمة فرعية" && (!req.ParentListId.HasValue || req.ParentListId.Value <= 0))
            return Json(new { success = false, message = "القائمة المستقلة مطلوبة للقائمة الفرعية" });

        if (req.ListType == "قائمة هرمية")
        {
            if (req.LevelCount < 2 || req.LevelCount > 4)
                return Json(new { success = false, message = "المستوى يجب أن يكون بين 2 و 4" });
        }

        var all = await _ds.ListDropdownListsAsync();
        var nextOrder = all.Count > 0 ? all.Max(l => l.SortOrder) + 1 : 1;
        var orgUnitId = await GetCreatorOrgUnitIdAsync();
        if (orgUnitId <= 0)
            return Json(new { success = false, message = "يجب إنشاء الوحدات التنظيمية أولاً" });

        var d = new DropdownList
        {
            Name = req.Name.Trim(),
            Description = req.Description?.Trim() ?? "",
            SortOrder = nextOrder,
            Ownership = req.Ownership,
            OrganizationalUnitId = orgUnitId,
            ListType = req.ListType,
            ParentListId = req.ListType == "قائمة فرعية" ? req.ParentListId : null,
            LevelCount = req.ListType == "قائمة هرمية" ? req.LevelCount : 2,
            LevelNamesJson = req.LevelNamesJson ?? "",
            SelectionType = req.SelectionType ?? "خيار محدد",
            IsActive = req.IsActive,
            CreatedBy = CurrentUserFullName
        };

        await _ds.AddDropdownListAsync(d);
        await _ds.AddAuditLogAsync(CurrentUserId, CurrentUserFullName, "إضافة قائمة منسدلة", "DropdownList", d.Id.ToString(), d.Name);

        return Json(new { success = true, message = "تم إضافة القائمة المنسدلة بنجاح", id = d.Id });
    }

    [HttpPost]
    public async Task<IActionResult> UpdateDropdownList([FromBody] DropdownListUpdateRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var d = await _ds.GetDropdownListByIdAsync(req.Id);
        if (d == null)
            return Json(new { success = false, message = "القائمة غير موجودة" });

        if (string.IsNullOrWhiteSpace(req.Name))
            return Json(new { success = false, message = "اسم القائمة المنسدلة مطلوب" });

        d.Name = req.Name.Trim();
        d.Description = req.Description?.Trim() ?? "";
        d.Ownership = req.Ownership ?? d.Ownership;
        d.ListType = req.ListType ?? d.ListType;
        d.ParentListId = req.ListType == "قائمة فرعية" ? req.ParentListId : null;
        d.LevelCount = req.ListType == "قائمة هرمية" ? Math.Clamp(req.LevelCount, 2, 4) : d.LevelCount;
        if (!string.IsNullOrEmpty(req.LevelNamesJson))
            d.LevelNamesJson = req.LevelNamesJson;
        d.SelectionType = req.SelectionType ?? d.SelectionType;
        d.IsActive = req.IsActive;

        await _ds.UpdateDropdownListAsync(d);
        await _ds.AddAuditLogAsync(CurrentUserId, CurrentUserFullName, "تحديث قائمة منسدلة", "DropdownList", d.Id.ToString(), d.Name);

        return Json(new { success = true, message = "تم تحديث القائمة بنجاح" });
    }

    [HttpPost]
    public async Task<IActionResult> DeleteDropdownList([FromBody] IdRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var d = await _ds.GetDropdownListByIdAsync(req.Id);
        if (d == null)
            return Json(new { success = false, message = "القائمة غير موجودة" });

        await _ds.DeleteDropdownListAsync(req.Id);
        await _ds.AddAuditLogAsync(CurrentUserId, CurrentUserFullName, "حذف قائمة منسدلة", "DropdownList", req.Id.ToString(), d.Name);

        return Json(new { success = true, message = "تم حذف القائمة بنجاح" });
    }

    [HttpPost]
    public async Task<IActionResult> SaveHierarchyLevelNames([FromBody] SaveLevelNamesRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var d = await _ds.GetDropdownListByIdAsync(req.Id);
        if (d == null)
            return Json(new { success = false, message = "القائمة غير موجودة" });

        d.LevelNamesJson = req.LevelNamesJson ?? "";
        await _ds.UpdateDropdownListAsync(d);
        return Json(new { success = true, message = "تم حفظ أسماء المستويات بنجاح" });
    }

    [HttpPost]
    public async Task<IActionResult> AddDropdownItem([FromBody] DropdownItemRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var list = await _ds.GetDropdownListByIdAsync(req.DropdownListId);
        if (list == null)
            return Json(new { success = false, message = "القائمة غير موجودة" });

        if (string.IsNullOrWhiteSpace(req.ItemText))
            return Json(new { success = false, message = "العنصر مطلوب" });

        var items = await _ds.ListDropdownItemsByListIdAsync(req.DropdownListId);
        var nextOrder = items.Count > 0 ? items.Max(i => i.SortOrder) + 1 : 1;

        var item = new DropdownItem
        {
            DropdownListId = req.DropdownListId,
            ItemText = req.ItemText.Trim(),
            Description = req.Description?.Trim() ?? "",
            Color = req.Color ?? "#25935F",
            IsActive = req.IsActive,
            SortOrder = nextOrder,
            ParentItemId = req.ParentItemId,
            LevelNumber = req.LevelNumber,
            LevelValuesJson = req.LevelValuesJson ?? ""
        };

        await _ds.AddDropdownItemAsync(item);
        return Json(new { success = true, message = "تم إضافة العنصر بنجاح", id = item.Id });
    }

    [HttpPost]
    public async Task<IActionResult> UpdateDropdownItem([FromBody] DropdownItemUpdateRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var item = await _ds.GetDropdownItemByIdAsync(req.Id);
        if (item == null)
            return Json(new { success = false, message = "العنصر غير موجود" });

        var ownerList = await _ds.GetDropdownListByIdAsync(item.DropdownListId);
        if (ownerList != null && !string.IsNullOrEmpty(ownerList.CreatedBy) && ownerList.CreatedBy != CurrentUserFullName)
            return Json(new { success = false, message = "يمكن تحديث العناصر من قبل منشئ القائمة فقط" });

        if (string.IsNullOrWhiteSpace(req.ItemText))
            return Json(new { success = false, message = "العنصر مطلوب" });

        item.ItemText = req.ItemText.Trim();
        item.Description = req.Description?.Trim() ?? "";
        item.Color = req.Color ?? item.Color;
        item.IsActive = req.IsActive;
        if (req.LevelValuesJson != null)
            item.LevelValuesJson = req.LevelValuesJson;
        if (req.ParentItemId.HasValue)
            item.ParentItemId = req.ParentItemId;

        await _ds.UpdateDropdownItemAsync(item);
        return Json(new { success = true, message = "تم تحديث العنصر بنجاح" });
    }

    [HttpPost]
    public async Task<IActionResult> DeleteDropdownItem([FromBody] IdRequest req)
    {
        if (!IsAuthenticated || CurrentUserRole != "Admin")
            return Json(new { success = false, message = "غير مصرح" });

        var item = await _ds.GetDropdownItemByIdAsync(req.Id);
        if (item == null)
            return Json(new { success = false, message = "العنصر غير موجود" });

        var ownerList = await _ds.GetDropdownListByIdAsync(item.DropdownListId);
        if (ownerList != null && !string.IsNullOrEmpty(ownerList.CreatedBy) && ownerList.CreatedBy != CurrentUserFullName)
            return Json(new { success = false, message = "يمكن حذف العناصر من قبل منشئ القائمة فقط" });

        await _ds.DeleteDropdownItemAsync(req.Id);
        return Json(new { success = true, message = "تم حذف العنصر بنجاح" });
    }
}

public class DropdownListRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? Ownership { get; set; }
    public string? ListType { get; set; }
    public int? ParentListId { get; set; }
    public int LevelCount { get; set; } = 2;
    public string? LevelNamesJson { get; set; }
    public string? SelectionType { get; set; }
    public bool IsActive { get; set; } = true;
}

public class DropdownListUpdateRequest : DropdownListRequest
{
    public int Id { get; set; }
}

public class DropdownItemRequest
{
    public int DropdownListId { get; set; }
    public string? ItemText { get; set; }
    public string? Description { get; set; }
    public string? Color { get; set; }
    public bool IsActive { get; set; } = true;
    public int? ParentItemId { get; set; }
    public int LevelNumber { get; set; }
    public string? LevelValuesJson { get; set; }
}

public class DropdownItemUpdateRequest
{
    public int Id { get; set; }
    public string? ItemText { get; set; }
    public string? Description { get; set; }
    public string? Color { get; set; }
    public bool IsActive { get; set; }
    public string? LevelValuesJson { get; set; }
    public int? ParentItemId { get; set; }
}

public class SaveLevelNamesRequest
{
    public int Id { get; set; }
    public string? LevelNamesJson { get; set; }
}

public class IdRequest
{
    public int Id { get; set; }
}
