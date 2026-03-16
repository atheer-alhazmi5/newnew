namespace FormsSystem.Models.Entities;

public class ReceivedForm
{
    public int Id { get; set; }
    public int FormId { get; set; }
    public string FormName { get; set; } = "";
    public string FormIcon { get; set; } = "document";
    public int SenderId { get; set; }
    public string SenderName { get; set; } = "";
    public string SenderDepartment { get; set; } = "";
    public int RecipientId { get; set; }
    public string RecipientName { get; set; } = "";
    public string Category { get; set; } = "fill_request";
    public DateTime SentDate { get; set; } = DateTime.UtcNow;
    public string Status { get; set; } = "قيد الانتظار";
    public bool IsRead { get; set; }
    public string? AnswersJson { get; set; }
    public DateTime? ReplyDate { get; set; }
    public int? SentFormId { get; set; }
    public string? TargetRecipientsJson { get; set; }
}
