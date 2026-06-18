namespace FormsSystem.Models.Entities;

/// <summary>إصدار من نموذج (FormDefinition). يحفظ لقطة الحقول/الأقسام/قواعد المنطق.</summary>
public class FormDefinitionVersion
{
    public int Id { get; set; }
    public int FormDefinitionId { get; set; }

    /// <summary>الرقم التسلسلي (1, 2, 3, ...). يُستخدم لتوليد الاسم V:1.0, V:2.0, ...</summary>
    public int VersionNumber { get; set; } = 1;

    /// <summary>الاسم المعروض (V:1.0, V:2.0, ...).</summary>
    public string VersionName { get; set; } = "V:1.0";

    /// <summary>لقطة كاملة لمحتوى النموذج (sections + fields + rules + meta).</summary>
    public string FieldsJson { get; set; } = "[]";

    /// <summary>draft = مسودة، approved = معتمد.</summary>
    public string Status { get; set; } = "draft";

    /// <summary>الإصدار النشط للنموذج (واحد فقط في كل وقت).</summary>
    public bool IsActive { get; set; } = false;

    public string CreatedBy { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public string? UpdatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
