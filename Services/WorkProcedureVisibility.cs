using FormsSystem.Models.Entities;

namespace FormsSystem.Services;

/// <summary>قواعد ظهور إجراءات العمل حسب دور المستخدم وحالة الإجراء.</summary>
public static class WorkProcedureVisibility
{
    public static bool IsDraft(string? status) =>
        string.Equals(status?.Trim(), "draft", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// مدير النظام: يرى الإجراءات المرسلة (pending/approved/rejected) ومسوداته الشخصية فقط.
    /// مسودات ممثل الوحدة التنظيمية مخفية حتى يُرسلها.
    /// </summary>
    public static bool IsVisibleToAdmin(WorkProcedure p, string? adminFullName)
    {
        if (!IsDraft(p.Status)) return true;
        if (string.IsNullOrWhiteSpace(adminFullName)) return false;
        return string.Equals((p.CreatedBy ?? "").Trim(), adminFullName.Trim(), StringComparison.OrdinalIgnoreCase);
    }

    public static IEnumerable<WorkProcedure> FilterForAdmin(IEnumerable<WorkProcedure> source, string? adminFullName) =>
        source.Where(p => IsVisibleToAdmin(p, adminFullName));
}
