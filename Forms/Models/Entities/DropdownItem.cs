namespace FormsSystem.Models.Entities;

public class DropdownItem
{
    public int Id { get; set; }
    public int DropdownListId { get; set; }

    public string ItemText { get; set; } = "";

    public string Description { get; set; } = "";
    public string Color { get; set; } = "#25935F";
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }

    public int? ParentItemId { get; set; }

    public int LevelNumber { get; set; }

    public string LevelValuesJson { get; set; } = "";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
