using FormsSystem.Models.Entities;

namespace FormsSystem.Services;

/// <summary>قواعد ظهور النماذج حسب دور المستخدم وحالة النموذج.</summary>
public static class FormDefinitionVisibility
{
    public static bool IsDraft(string? status) =>
        string.Equals(status?.Trim(), "draft", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// مدير النظام: يرى النماذج المرسلة (pending/approved/rejected) ومسوداته الشخصية فقط.
    /// مسودات ممثل الوحدة التنظيمية مخفية حتى يُرسلها.
    /// </summary>
    public static bool IsVisibleToAdmin(FormDefinition f, string? adminFullName)
    {
        if (!IsDraft(f.Status)) return true;
        if (string.IsNullOrWhiteSpace(adminFullName)) return false;
        return string.Equals((f.CreatedBy ?? "").Trim(), adminFullName.Trim(), StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// ممثل الوحدة: يرى النماذج العامة وخاصة وحدته.
    /// مسودة (عام): للمنشئ فقط — لا تظهر لممثلي وحدات أخرى.
    /// </summary>
    public static bool IsVisibleToEmployee(FormDefinition f, int myOrgUnitId, string? employeeFullName)
    {
        if (IsDraft(f.Status) && string.Equals(f.Ownership, "عام", StringComparison.Ordinal))
        {
            if (string.IsNullOrWhiteSpace(employeeFullName)) return false;
            return string.Equals((f.CreatedBy ?? "").Trim(), employeeFullName.Trim(), StringComparison.OrdinalIgnoreCase);
        }

        return string.Equals(f.Ownership, "عام", StringComparison.Ordinal) ||
            (string.Equals(f.Ownership, "خاص", StringComparison.Ordinal) && f.OrganizationalUnitId == myOrgUnitId);
    }

    public static bool IsVisibleToUser(FormDefinition f, bool isAdmin, string? userFullName, int myOrgUnitId) =>
        isAdmin ? IsVisibleToAdmin(f, userFullName) : IsVisibleToEmployee(f, myOrgUnitId, userFullName);

    public static IEnumerable<FormDefinition> FilterForAdmin(IEnumerable<FormDefinition> source, string? adminFullName) =>
        source.Where(f => IsVisibleToAdmin(f, adminFullName));

    public static IEnumerable<FormDefinition> FilterForEmployee(IEnumerable<FormDefinition> source, int myOrgUnitId, string? employeeFullName) =>
        source.Where(f => IsVisibleToEmployee(f, myOrgUnitId, employeeFullName));
}
