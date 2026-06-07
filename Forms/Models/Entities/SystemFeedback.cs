namespace FormsSystem.Models.Entities;

/// <summary>تقييم مستخدم للنظام — مرة واحدة لكل مستخدم.</summary>
public class SystemFeedback
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string SubmitterName { get; set; } = "";
    public int? OrganizationalUnitId { get; set; }
    public string OrganizationalUnitName { get; set; } = "";
    /// <summary>ممتاز | جيد | متوسط | منخفض | منخفض جداً</summary>
    public string OverallRating { get; set; } = "";
    public string EaseOfUse { get; set; } = "";
    public string Design { get; set; } = "";
    public string Performance { get; set; } = "";
    public string TechnicalSupport { get; set; } = "";
    public string? Notes { get; set; }
    public bool IsPublished { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
