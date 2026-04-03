namespace FormsSystem.Models.Entities;

public class DropdownList
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public int SortOrder { get; set; }

    public string Ownership { get; set; } = "عام";

    public int OrganizationalUnitId { get; set; }

    public string ListType { get; set; } = "قائمة مستقلة";

    public int? ParentListId { get; set; }

    public int LevelCount { get; set; } = 2;
    public string LevelNamesJson { get; set; } = "";

    public string SelectionType { get; set; } = "خيار محدد";

    public bool IsActive { get; set; } = true;

    public string CreatedBy { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
