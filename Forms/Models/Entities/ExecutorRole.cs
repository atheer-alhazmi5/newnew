namespace FormsSystem.Models.Entities;

public class ExecutorRole
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string Ownership { get; set; } = "حصري";
    public string OrgUnitIds { get; set; } = "";
    public string ExecutorIds { get; set; } = "";
    public string Color { get; set; } = "#25935F";
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public string CreatedBy { get; set; } = "";
    public string UpdatedBy { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
