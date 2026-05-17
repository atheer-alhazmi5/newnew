namespace FormsSystem.Models.Entities;

/// <summary>أنواع الإجراءات — مطابقة لبنية «أنواع النماذج» (FormSection) من حيث الحقول الأساسية.</summary>
public class ProcedureActionType
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public string? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? UpdatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
