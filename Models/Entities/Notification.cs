namespace FormsSystem.Models.Entities;

public class Notification
{
    public int Id { get; set; }
    public int? FormId { get; set; }
    public string FormName { get; set; } = "";
    public int RecipientId { get; set; }
    public string Type { get; set; } = "form_received"; // form_received | form_reply | fill_request | approval_request
    public string Title { get; set; } = "";
    public string Message { get; set; } = "";
    public string SenderName { get; set; } = "";
    public string SenderDepartment { get; set; } = "";
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
