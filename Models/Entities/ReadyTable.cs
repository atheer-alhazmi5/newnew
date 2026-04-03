namespace FormsSystem.Models.Entities;

public class ReadyTable
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public int SortOrder { get; set; }
    public string RowCountMode { get; set; } = "مفتوح"; // مفتوح | مقيد
    public int? MaxRows { get; set; }
    public int OrganizationalUnitId { get; set; }
    public string Ownership { get; set; } = "عام"; // عام | خاص
    public string ColumnHeaderColor { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public string CreatedBy { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? UpdatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
