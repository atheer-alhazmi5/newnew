namespace FormsSystem.Models.Entities;

public class SupportTicket
{
    public int Id { get; set; }
    public string RequestNumber { get; set; } = "";
    public int SubmittedById { get; set; }
    public string SubmitterName { get; set; } = "";
    public int? OrganizationalUnitId { get; set; }
    public string OrganizationalUnitName { get; set; } = "";
    /// <summary>استفسار | شكوى | ملاحظة | اقتراح | دعم فني | طلب تفويض</summary>
    public string Category { get; set; } = "";
    /// <summary>عالية | متوسطة | منخفضة</summary>
    public string Importance { get; set; } = "متوسطة";
    public string Subject { get; set; } = "";
    public string Content { get; set; } = "";
    /// <summary>JSON: [{ "name": "", "url": "" }]</summary>
    public string AttachmentsJson { get; set; } = "[]";
    /// <summary>مفتوح | مغلق</summary>
    public string Status { get; set; } = "مفتوح";
    public string Response { get; set; } = "";
    public int? RespondedById { get; set; }
    public string RespondedByName { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
