namespace FormsSystem.Models.Entities;

public class FormDefinition
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string Ownership { get; set; } = "عام"; // عام | خاص
    public int CategoryId { get; set; }      // قديم — للتوافق مع بيانات JSON السابقة
    public int FormClassId { get; set; }      // أصناف النماذج (FormClass)
    public int FormTypeId { get; set; }       // نوع النموذج (FormSection)
    public int WorkspaceId { get; set; }
    public int TemplateId { get; set; }
    // Snapshot of selected template at save time (for stable render/print even if template changes later)
    public string TemplateNameSnapshot { get; set; } = "";
    public string TemplateColorSnapshot { get; set; } = "";
    public string TemplateHeaderJsonSnapshot { get; set; } = "[]";
    public string TemplateFooterJsonSnapshot { get; set; } = "[]";
    public int TemplateMarginTopSnapshot { get; set; } = 20;
    public int TemplateMarginBottomSnapshot { get; set; } = 20;
    public int TemplateMarginRightSnapshot { get; set; } = 20;
    public int TemplateMarginLeftSnapshot { get; set; } = 20;
    public string TemplatePageDirectionSnapshot { get; set; } = "RTL";
    public bool TemplateShowHeaderLineSnapshot { get; set; } = true;
    public bool TemplateShowFooterLineSnapshot { get; set; } = true;
    public int OrganizationalUnitId { get; set; }  // auto from creator

    // Status: draft | pending | approved | rejected
    public string Status { get; set; } = "draft";
    public string RejectionReason { get; set; } = "";
    public bool IsActive { get; set; } = false;

    // Content (fields JSON — same shape as ReadyTableField)
    public string FieldsJson { get; set; } = "[]";

    // Audit
    public string CreatedBy { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public string? UpdatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
}
