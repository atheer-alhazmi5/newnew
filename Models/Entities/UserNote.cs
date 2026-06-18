namespace FormsSystem.Models.Entities;

/// <summary>ملاحظة مستخدم — sticky notes.</summary>
public class UserNote
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Title { get; set; } = "";
    public string ContentHtml { get; set; } = "";
    /// <summary>عالية | متوسطة | منخفضة</summary>
    public string Importance { get; set; } = "متوسطة";
    public string Color { get; set; } = "#fef9c3";
    public bool IsPinned { get; set; }
    public bool IsArchived { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
