namespace FormsSystem.Models.Entities;

/// <summary>
/// تسليم طلب صادر (OutboxRequest) إلى مستخدم مستهدف (منفذ/معتمد) في خطوة سير عمل محددة.
/// كل سجل = طلب موجَّه إلى مستخدم واحد ضمن صندوق الوارد.
/// </summary>
public class OutboxAssignment
{
    public int Id { get; set; }

    public int OutboxRequestId { get; set; }
    public string RequestNumber { get; set; } = "";

    public int WorkProcedureId { get; set; }
    public string ProcedureName { get; set; } = "";
    public string ProcedureCode { get; set; } = "";
    public string ProcedureTypeName { get; set; } = "";
    public string ProcedureTypeIcon { get; set; } = "";
    public string ProcedureTypeColor { get; set; } = "#25935F";

    /// <summary>الخطوة من سير العمل التي وُجّه إليها هذا التسليم (sortOrder + id + label).</summary>
    public int StepSortOrder { get; set; } = 1;
    public int StepId { get; set; }
    public string StepLabel { get; set; } = "";

    /// <summary>كيف تم اختيار هذا المستلم: specific | unit_manager | unit_representative</summary>
    public string AssignedVia { get; set; } = "specific";

    /// <summary>المستلم (مستخدم النظام)</summary>
    public int RecipientUserId { get; set; }
    public string RecipientName { get; set; } = "";
    public string RecipientUsername { get; set; } = "";
    public string RecipientDept { get; set; } = "";

    /// <summary>المرسل = مُقدِّم الطلب</summary>
    public int SenderId { get; set; }
    public string SenderName { get; set; } = "";
    public string SenderDept { get; set; } = "";

    /// <summary>"قيد الانتظار" | "تمت المراجعة" | "تم الاعتماد" | "تم الرفض" | "تم الإرجاع" | "ملغى"</summary>
    public string Status { get; set; } = "قيد الانتظار";

    /// <summary>الإجراء الذي اتخذه المستلم: approve | reject | return | "" (لم يتخذ بعد)</summary>
    public string Action { get; set; } = "";

    /// <summary>سبب الرفض/الإرجاع/ملاحظات المستلم.</summary>
    public string ResponseNotes { get; set; } = "";

    public bool IsRead { get; set; }
    public DateTime AssignedAt { get; set; } = DateTime.Now;
    public DateTime? ReadAt { get; set; }
    public DateTime? ActedAt { get; set; }
}
