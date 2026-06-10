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
    /// <summary>سبب التعطيل عندما يكون <see cref="IsActive"/> false.</summary>
    public string DeactivateReason { get; set; } = "";
    /// <summary>ترتيب الأخوة ضمن نفس الأب (1-based).</summary>
    public int SortOrder { get; set; }
    /// <summary>مسار هرمي للعرض، مثل 1 أو 1،1 أو 1،2.</summary>
    public string OrderPath { get; set; } = "";
    public string CreatedBy { get; set; } = "مدير النظام";
    public string UpdatedBy { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
