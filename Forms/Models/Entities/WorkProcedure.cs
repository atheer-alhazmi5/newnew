namespace FormsSystem.Models.Entities;

public class WorkProcedure
{
    public int Id { get; set; }

    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string Objectives { get; set; } = "";

    public string RegulationsAttachmentsJson { get; set; } = "[]";

    public int WorkspaceId { get; set; }

    public string UsedFormDefinitionsJson { get; set; } = "[]";

   
    public string ExecutorBeneficiaryIdsJson { get; set; } = "[]";

    public string UsageFrequency { get; set; } = "شهري";

    public string ProcedureClassification { get; set; } = "رئيسي";

    
    public string ConfidentialityLevel { get; set; } = "متوسط";

    public string ValidityType { get; set; } = "دائم";

    public DateTime? ValidityStartDate { get; set; }
    public DateTime? ValidityEndDate { get; set; }

    public int OrganizationalUnitId { get; set; }

    public string TargetOrganizationalUnitIdsJson { get; set; } = "[]";

    public string PreviousProcedureIdsJson { get; set; } = "[]";
    public string NextProcedureIdsJson { get; set; } = "[]";
    public string ImplicitProcedureIdsJson { get; set; } = "[]";

    /// <summary>JSON array of workflow steps for this procedure (managed via سير العمل UI).</summary>
    public string WorkflowStepsJson { get; set; } = "[]";

    public string AdditionalInputs { get; set; } = "";
    public string AdditionalOutputs { get; set; } = "";

    public string Status { get; set; } = "draft";
    public string RejectionReason { get; set; } = "";
    public bool IsActive { get; set; }

    public string CreatedBy { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public string? UpdatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
}
