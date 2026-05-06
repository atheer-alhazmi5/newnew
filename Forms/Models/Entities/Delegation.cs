namespace FormsSystem.Models.Entities;

public class Delegation
{
    public int Id { get; set; }

    /// <summary>مرجع فريد لكل تفويض (أعداد صحيحة موجبة فقط؛ 0 للسجلات القديمة قبل إضافة الحقل).</summary>
    public int ReferenceNumber { get; set; }

    public string DelegationReason { get; set; } = "";

    public int DelegatorBeneficiaryId { get; set; }
    public int DelegatorOrgUnitId { get; set; }

  
    public int DelegateeBeneficiaryId { get; set; }
    public int DelegateeOrgUnitId { get; set; }

   
    public DateTime StartDate { get; set; }
  
    public DateTime EndDate { get; set; }

    public string Status { get; set; } = "draft";

    public string CreatedBy { get; set; } = "";
    public string? UpdatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime? UpdatedAt { get; set; }
}
