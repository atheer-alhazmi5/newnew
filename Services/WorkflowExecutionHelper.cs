using System.Text.Json;
using System.Text.Json.Serialization;
using FormsSystem.Models.Entities;

namespace FormsSystem.Services;

/// <summary>تنفيذ سير العمل: تعيين المنفذين، التقدم بين الخطوات، ودمج بيانات الأقسام.</summary>
public static class WorkflowExecutionHelper
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        WriteIndented = false
    };

    public sealed class WorkflowStepRuntime
    {
        public int Id { get; set; }
        public int SortOrder { get; set; }
        public bool IsDecision { get; set; }
        public string StepLabel { get; set; } = "";
        public int ExecutorRoleId { get; set; }
        public string ExpectedDurationDays { get; set; } = "";
        public string ExpectedDurationHours { get; set; } = "";
        public int? FormDefinitionId { get; set; }
        public int? FormSectionId { get; set; }
        public int? FormStatusId { get; set; }
        public string AssigneeMode { get; set; } = "specific";
        public string AssigneeFixedType { get; set; } = "";
        public int? AssigneeOrgUnitId { get; set; }
        public List<string>? AllowedActions { get; set; }
        public int? ReturnStepId { get; set; }
        public int? ConcurrentStepId { get; set; }
    }

    public sealed class RecipientCandidate
    {
        public int UserId { get; set; }
        public string Username { get; set; } = "";
        public string FullName { get; set; } = "";
        public string Dept { get; set; } = "";
        public int BeneficiaryId { get; set; }
        public string AssignedVia { get; set; } = "specific";
    }

    public static List<WorkflowStepRuntime> ParseSteps(WorkProcedure? proc)
    {
        if (proc == null || string.IsNullOrWhiteSpace(proc.WorkflowStepsJson)) return new();
        try
        {
            return JsonSerializer.Deserialize<List<WorkflowStepRuntime>>(proc.WorkflowStepsJson, JsonOpts) ?? new();
        }
        catch { return new(); }
    }

    public static WorkflowStepRuntime? GetStepById(WorkProcedure proc, int stepId)
        => ParseSteps(proc).FirstOrDefault(s => s.Id == stepId);

    public static WorkflowStepRuntime? GetFirstStep(WorkProcedure proc)
        => ParseSteps(proc).Where(s => !s.IsDecision).OrderBy(s => s.SortOrder).FirstOrDefault();

    public static WorkflowStepRuntime? GetNextStep(WorkProcedure proc, int currentSortOrder)
        => ParseSteps(proc).Where(s => !s.IsDecision && s.SortOrder > currentSortOrder).OrderBy(s => s.SortOrder).FirstOrDefault();

    public sealed class StepFormContext
    {
        public int StepId { get; set; }
        public string StepLabel { get; set; } = "";
        public int? FormDefinitionId { get; set; }
        public int? FormSectionId { get; set; }
        public string SectionTitle { get; set; } = "";
        public List<long> EditableFieldIds { get; set; } = new();
        public bool HideOtherSections { get; set; }
    }

    public static StepFormContext? BuildStepFormContext(
        WorkProcedure proc,
        WorkflowStepRuntime step,
        IReadOnlyDictionary<int, FormDefinition> fdById,
        bool hideOtherSections = false)
    {
        if (step.IsDecision) return null;

        var (formId, sectionId) = ResolveStepFormBinding(step, proc, fdById);
        if (!formId.HasValue || formId.Value <= 0 || !fdById.TryGetValue(formId.Value, out var fd))
            return null;

        var sections = WorkflowSectionHelper.ParseSections(fd.FieldsJson);
        var sid = sectionId;
        if (!sid.HasValue || sid.Value <= 0)
        {
            if (sections.Count == 1) sid = sections[0].Id;
            else if (sections.Count == 0) sid = 1;
            else return null;
        }

        return new StepFormContext
        {
            StepId = step.Id,
            StepLabel = step.StepLabel ?? "",
            FormDefinitionId = formId,
            FormSectionId = sid,
            SectionTitle = WorkflowSectionHelper.SectionTitle(fd, sid.Value) ?? "",
            EditableFieldIds = WorkflowSectionHelper.FieldIdsInSection(fd.FieldsJson, sid.Value).ToList(),
            HideOtherSections = hideOtherSections
        };
    }

    public static (int? FormId, int? SectionId) ResolveStepFormBinding(
        WorkflowStepRuntime step,
        WorkProcedure proc,
        IReadOnlyDictionary<int, FormDefinition> fdById)
    {
        var usedIds = ParseUsedFormIds(proc.UsedFormDefinitionsJson);
        return WorkflowSectionHelper.ResolveStepBinding(step.FormDefinitionId, step.FormSectionId, usedIds, fdById);
    }

    public static List<int> ParseUsedFormIds(string? json)
    {
        var result = new List<int>();
        if (string.IsNullOrWhiteSpace(json)) return result;
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Array) return result;
            foreach (var el in doc.RootElement.EnumerateArray())
            {
                if (el.ValueKind == JsonValueKind.Number && el.TryGetInt32(out var n))
                    result.Add(n);
                else if (el.ValueKind == JsonValueKind.Object)
                {
                    foreach (var key in new[] { "formDefinitionId", "FormDefinitionId", "id", "Id" })
                    {
                        if (el.TryGetProperty(key, out var p) && p.TryGetInt32(out var v))
                        {
                            result.Add(v);
                            break;
                        }
                    }
                }
            }
        }
        catch { /* ignore */ }
        return result;
    }

    public static async Task<List<RecipientCandidate>> ResolveStepRecipientsAsync(
        DataService ds,
        WorkProcedure proc,
        WorkflowStepRuntime step,
        int? contextUserId = null)
    {
        var results = new List<RecipientCandidate>();
        if (step == null) return results;

        var beneficiaries = await ds.ListBeneficiariesAsync();
        var users = await ds.ListUsersAsync();
        var unitsAll = await ds.ListOrganizationalUnitsAsync();
        var targetOrgIds = ParseIntArray(proc.TargetOrganizationalUnitIdsJson);

        User? UserOfBeneficiary(Beneficiary b)
        {
            if (string.IsNullOrWhiteSpace(b.Username)) return null;
            return users.FirstOrDefault(u => string.Equals(u.Username?.Trim(), b.Username.Trim(), StringComparison.OrdinalIgnoreCase));
        }

        var mode = (step.AssigneeMode ?? "specific").Trim().ToLowerInvariant();

        if (mode == "specific")
        {
            if (step.ExecutorRoleId > 0)
            {
                var roles = await ds.ListExecutorRolesAsync();
                var role = roles.FirstOrDefault(r => r.Id == step.ExecutorRoleId);
                if (role != null)
                {
                    foreach (var bid in ParseCsvIntIds(role.ExecutorIds))
                    {
                        var b = beneficiaries.FirstOrDefault(x => x.Id == bid && x.IsActive);
                        if (b == null) continue;
                        var u = UserOfBeneficiary(b);
                        if (u == null) continue;
                        AddIfNew(results, u, b, "specific", unitsAll);
                    }
                }
            }
        }
        else if (mode == "fixed")
        {
            var ft = (step.AssigneeFixedType ?? "").Trim().ToLowerInvariant();
            var scopeUnitIds = new List<int>();
            if (step.AssigneeOrgUnitId.HasValue && step.AssigneeOrgUnitId.Value > 0)
                scopeUnitIds.Add(step.AssigneeOrgUnitId.Value);
            else
                scopeUnitIds.AddRange(targetOrgIds);

            if (ft == "employee" && contextUserId.HasValue && contextUserId.Value > 0)
            {
                var u = users.FirstOrDefault(x => x.Id == contextUserId.Value);
                if (u != null)
                {
                    var b = beneficiaries.FirstOrDefault(x => x.IsActive && !string.IsNullOrWhiteSpace(x.Username)
                        && string.Equals(x.Username.Trim(), u.Username?.Trim(), StringComparison.OrdinalIgnoreCase));
                    if (b != null) AddIfNew(results, u, b, "employee", unitsAll);
                    else AddIfNewUserOnly(results, u, "employee", unitsAll, beneficiaries);
                }
            }
            else if (ft == "unit_manager")
            {
                foreach (var b in beneficiaries.Where(x => x.IsActive && x.IsUnitManager && x.OrganizationalUnitId.HasValue && scopeUnitIds.Contains(x.OrganizationalUnitId.Value)))
                {
                    var u = UserOfBeneficiary(b);
                    if (u == null) continue;
                    AddIfNew(results, u, b, "unit_manager", unitsAll);
                }
            }
            else if (ft == "unit_representative")
            {
                foreach (var b in beneficiaries.Where(x => x.IsActive && (x.SubRole ?? "").Trim() == "ممثل الوحدة التنظيمية" && x.OrganizationalUnitId.HasValue && scopeUnitIds.Contains(x.OrganizationalUnitId.Value)))
                {
                    var u = UserOfBeneficiary(b);
                    if (u == null) continue;
                    AddIfNew(results, u, b, "unit_representative", unitsAll);
                }
            }
            else if (ft == "system_admin")
            {
                foreach (var b in beneficiaries.Where(x => x.IsActive && string.Equals((x.SubRole ?? "").Trim(), "مدير النظام", StringComparison.Ordinal)))
                {
                    var u = UserOfBeneficiary(b);
                    if (u == null) continue;
                    AddIfNew(results, u, b, "system_admin", unitsAll);
                }
            }
        }

        return results;
    }

    public static DateTime? ComputeDueAt(DateTime submittedAt, WorkflowStepRuntime? step)
    {
        if (step == null) return null;
        var totalHours = 0.0;
        if (double.TryParse(step.ExpectedDurationDays, out var d) && d > 0) totalHours += d * 24.0;
        if (double.TryParse(step.ExpectedDurationHours, out var h) && h > 0) totalHours += h;
        if (totalHours <= 0) return null;
        return submittedAt.AddHours(totalHours);
    }

    public static string MergeSectionFormAnswers(string existingJson, string incomingJson, HashSet<long>? allowedFieldIds)
    {
        if (string.IsNullOrWhiteSpace(incomingJson)) return existingJson ?? "{}";
        if (string.IsNullOrWhiteSpace(existingJson)) return incomingJson;

        try
        {
            using var existDoc = JsonDocument.Parse(existingJson);
            using var inDoc = JsonDocument.Parse(incomingJson);
            if (inDoc.RootElement.ValueKind != JsonValueKind.Object) return existingJson;

            var incomingFields = new Dictionary<long, JsonElement>();
            if (inDoc.RootElement.TryGetProperty("fields", out var inFields) && inFields.ValueKind == JsonValueKind.Array)
            {
                foreach (var f in inFields.EnumerateArray())
                {
                    if (f.TryGetProperty("id", out var idEl) && idEl.TryGetInt64(out var fid))
                    {
                        if (allowedFieldIds == null || allowedFieldIds.Contains(fid))
                            incomingFields[fid] = f.Clone();
                    }
                }
            }

            using var stream = new MemoryStream();
            using (var writer = new Utf8JsonWriter(stream))
            {
                writer.WriteStartObject();
                foreach (var prop in existDoc.RootElement.EnumerateObject())
                {
                    if (prop.NameEquals("fields") && prop.Value.ValueKind == JsonValueKind.Array)
                    {
                        writer.WritePropertyName("fields");
                        writer.WriteStartArray();
                        var written = new HashSet<long>();
                        foreach (var entry in prop.Value.EnumerateArray())
                        {
                            var fid = entry.TryGetProperty("id", out var idEl) && idEl.TryGetInt64(out var id) ? id : 0L;
                            if (fid > 0 && incomingFields.TryGetValue(fid, out var repl))
                            {
                                repl.WriteTo(writer);
                                written.Add(fid);
                            }
                            else entry.WriteTo(writer);
                        }
                        foreach (var kv in incomingFields)
                        {
                            if (!written.Contains(kv.Key))
                                kv.Value.WriteTo(writer);
                        }
                        writer.WriteEndArray();
                    }
                    else
                    {
                        writer.WritePropertyName(prop.Name);
                        prop.Value.WriteTo(writer);
                    }
                }
                if (!existDoc.RootElement.TryGetProperty("fields", out _))
                {
                    writer.WritePropertyName("fields");
                    writer.WriteStartArray();
                    foreach (var kv in incomingFields)
                        kv.Value.WriteTo(writer);
                    writer.WriteEndArray();
                }
                writer.WriteEndObject();
            }
            return System.Text.Encoding.UTF8.GetString(stream.ToArray());
        }
        catch { return existingJson; }
    }

    private static void AddIfNew(List<RecipientCandidate> list, User u, Beneficiary b, string via, List<OrganizationalUnit> units)
    {
        if (list.Any(x => x.UserId == u.Id)) return;
        var unitName = (b.OrganizationalUnitId.HasValue
            ? units.FirstOrDefault(o => o.Id == b.OrganizationalUnitId.Value)?.Name
            : null) ?? "";
        list.Add(new RecipientCandidate
        {
            UserId = u.Id,
            Username = u.Username ?? "",
            FullName = !string.IsNullOrWhiteSpace(u.FullName) ? u.FullName : b.FullName,
            Dept = unitName,
            BeneficiaryId = b.Id,
            AssignedVia = via
        });
    }

    private static void AddIfNewUserOnly(List<RecipientCandidate> list, User u, string via, List<OrganizationalUnit> units, List<Beneficiary> beneficiaries)
    {
        if (list.Any(x => x.UserId == u.Id)) return;
        var b = beneficiaries.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x.Username)
            && string.Equals(x.Username.Trim(), u.Username?.Trim(), StringComparison.OrdinalIgnoreCase));
        list.Add(new RecipientCandidate
        {
            UserId = u.Id,
            Username = u.Username ?? "",
            FullName = u.FullName ?? "",
            Dept = "",
            BeneficiaryId = b?.Id ?? 0,
            AssignedVia = via
        });
    }

    private static IEnumerable<int> ParseCsvIntIds(string? csv)
    {
        if (string.IsNullOrWhiteSpace(csv)) yield break;
        foreach (var part in csv.Split(',', StringSplitOptions.RemoveEmptyEntries))
        {
            if (int.TryParse(part.Trim(), out var n) && n > 0) yield return n;
        }
    }

    private static List<int> ParseIntArray(string? json)
    {
        var result = new List<int>();
        if (string.IsNullOrWhiteSpace(json)) return result;
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Array) return result;
            foreach (var el in doc.RootElement.EnumerateArray())
            {
                if (el.ValueKind == JsonValueKind.Number && el.TryGetInt32(out var n))
                    result.Add(n);
            }
        }
        catch { /* ignore */ }
        return result;
    }
}
