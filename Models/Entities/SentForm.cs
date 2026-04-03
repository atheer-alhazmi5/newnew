namespace FormsSystem.Models.Entities;

public class SentForm
{
    public int Id { get; set; }
    public int FormId { get; set; }
    public string FormName { get; set; } = "";
    public string FormIcon { get; set; } = "document";
    public int SenderId { get; set; }
    public string SenderName { get; set; } = "";
    public string SenderDepartment { get; set; } = "";
    public string SentToJson { get; set; } = "[]"; // JSON array of recipient ids/names
    public DateTime SentDate { get; set; } = DateTime.UtcNow;
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public string Status { get; set; } = "published"; // published | pending_approval
    public string FormStatus { get; set; } = "active";
}
