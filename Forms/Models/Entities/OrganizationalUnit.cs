namespace FormsSystem.Models.Entities;

public class OrganizationalUnit
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int ClassificationId { get; set; }
    /// <summary>يُعبأ تلقائياً من ParentId عند الحفظ: بدون أب = رئيسي، مع أب = فرعي. يُبقى للتوافق مع البيانات المخزنة.</summary>
    public string Level { get; set; } = "رئيسي"; // رئيسي | فرعي
    public int? ParentId { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
    public string CreatedBy { get; set; } = "مدير النظام";
    public string UpdatedBy { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
