using System.Text.Json;
using FormsSystem.Models.Entities;

namespace FormsSystem.Services;

/// <summary>قواعد ظهور إجراءات العمل حسب دور المستخدم وحالة الإجراء.</summary>
public static class WorkProcedureVisibility
{
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    public static List<int> ParseJsonIntIds(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new List<int>();
        try
        {
            return JsonSerializer.Deserialize<List<int>>(json, JsonOpts)?.Where(x => x > 0).ToList() ?? new List<int>();
        }
        catch
        {
            return new List<int>();
        }
    }

    /// <summary>
    /// ظهور الإجراء في «تقديم طلب جديد»: المستفيدون المعنيون أولاً، وإلا الوحدات المستهدفة.
    /// </summary>
    public static bool IsVisibleForSubmit(WorkProcedure p, int? beneficiaryId, int userOrgUnitId)
    {
        var targetBenIds = ParseJsonIntIds(p.TargetBeneficiaryIdsJson);
        if (targetBenIds.Count > 0)
            return beneficiaryId.HasValue && beneficiaryId.Value > 0 && targetBenIds.Contains(beneficiaryId.Value);

        var targetOrgIds = ParseJsonIntIds(p.TargetOrganizationalUnitIdsJson);
        if (targetOrgIds.Count > 0)
            return userOrgUnitId > 0 && targetOrgIds.Contains(userOrgUnitId);

        return false;
    }

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
