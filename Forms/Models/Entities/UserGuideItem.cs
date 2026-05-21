namespace FormsSystem.Models.Entities;

/// <summary>
/// عنصر «دليل المستخدم» — شجرة قوائم/صفحات بعدد مستويات غير محدود.
/// الترتيب: فهرس ضمن الإخوة في نفس المستوى؛ يُعرض في الواجهة كمسار مثل 1-2-3.
/// </summary>
public class UserGuideItem
{
    public int Id { get; set; }

    /// <summary>عند null → عنصر جذر. خلاف ذلك → تابع لعنصر آخر في الشجرة.</summary>
    public int? ParentId { get; set; }

    public string Name { get; set; } = "";

    /// <summary>محتوى الصفحة (HTML/نص).</summary>
    public string Content { get; set; } = "";

    /// <summary>صورة مرفقة (data URL أو رابط).</summary>
    public string AttachmentUrl { get; set; } = "";

    /// <summary>صورة الأيقونة (data URL أو رابط).</summary>
    public string Icon { get; set; } = "";
    public string Color { get; set; } = "#25935F";

    public string Notes { get; set; } = "";

    /// <summary>الترتيب داخل المستوى: للجذور = 1..N، وللأبناء = فهرس ضمن نفس الأب 1..M.</summary>
    public int SortOrder { get; set; }

    public bool IsActive { get; set; } = true;

    public string CreatedBy { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? UpdatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
