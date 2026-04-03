namespace FormsSystem.Models.Entities;

public class Form
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string Icon { get; set; } = "document";
    public string Type { get; set; } = "ready_made"; // ready_made | published
    public string Category { get; set; } = "";
    public int? CategoryId { get; set; }
    public string CreatedBy { get; set; } = "";
    public string CreatedByDepartment { get; set; } = "";
    public string SectionsJson { get; set; } = "[]";
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public bool PinAsReady { get; set; }
    public int? CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
