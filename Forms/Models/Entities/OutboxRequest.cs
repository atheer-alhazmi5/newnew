namespace FormsSystem.Models.Entities;

/// <summary>
/// طلب صادر مرتبط بإجراء عمل (WorkProcedure).
/// يحفظ رقم الطلب التلقائي بصيغة REQ-YYYY-MM-DD-# مع المرحلة الحالية والأولوية والـ SLA.
/// </summary>
public class OutboxRequest
{
    public int Id { get; set; }

    /// <summary>رقم الطلب التلقائي: REQ-YYYY-MM-DD-#</summary>
    public string RequestNumber { get; set; } = "";

    public int WorkProcedureId { get; set; }

    /// <summary>تسلسل الخطوة الحالية (sortOrder) ضمن WorkflowSteps الخاص بالإجراء.</summary>
    public int CurrentStepSortOrder { get; set; } = 1;

    /// <summary>معرّف خطوة سير العمل الحالية (للربط المباشر).</summary>
    public int CurrentStepId { get; set; }

    /// <summary>FormStatusId المرتبط بالخطوة الحالية — يحدد «الحالة/المرحلة» وتصنيفها (مفتوح/مغلق).</summary>
    public int? CurrentFormStatusId { get; set; }

    /// <summary>الأولوية: منخفض | متوسط | مرتفع (من مستوى الأولوية في إجراء العمل)</summary>
    public string Priority { get; set; } = "متوسط";

    /// <summary>تصنيف الحالة المُحسوب: مفتوح | مغلق</summary>
    public string StatusCategory { get; set; } = "مفتوح";

    /// <summary>قيمة الـ SLA الحالية: مبكر | في الموعد | متأخر | تم التصعيد</summary>
    public string SlaState { get; set; } = "في الموعد";

    /// <summary>الموعد المتوقع للإنجاز بناء على ExpectedDurationDays/Hours في سير العمل.</summary>
    public DateTime? ExpectedDueAt { get; set; }

    /// <summary>تاريخ ووقت تقديم الطلب.</summary>
    public DateTime SubmittedAt { get; set; } = DateTime.Now;

    /// <summary>تاريخ ووقت إغلاق الطلب (إن وُجد).</summary>
    public DateTime? ClosedAt { get; set; }

    /// <summary>هل تم التصعيد؟ (تجاوز الوقت + علم التصعيد المرفوع).</summary>
    public bool IsEscalated { get; set; }

    /// <summary>JSON بالقيم التي ملأها المستخدم في النموذج (مرن — مفتاح/قيمة).</summary>
    public string FormDataJson { get; set; } = "{}";

    /// <summary>ملاحظات اختيارية على الطلب.</summary>
    public string Notes { get; set; } = "";

    public int SubmittedById { get; set; }
    public string SubmittedByName { get; set; } = "";
    public string SubmittedByDept { get; set; } = "";

    public string? UpdatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
