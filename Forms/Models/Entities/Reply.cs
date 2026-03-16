namespace FormsSystem.Models.Entities;

public class Reply
{
    public int Id { get; set; }
    public int ReceivedFormId { get; set; }
    public int FormId { get; set; }
    public string FormName { get; set; } = "";
    public int ResponderId { get; set; }
    public string ResponderName { get; set; } = "";
    public string ResponderDepartment { get; set; } = "";
    public string AnswersJson { get; set; } = "{}";
    public DateTime ReplyDate { get; set; } = DateTime.UtcNow;
}
