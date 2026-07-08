using System.Text.Json;
using FormsSystem.Models.Entities;

namespace FormsSystem.Services;

/// <summary>أقسام النماذج وربط خطوات سير العمل بالنموذج/القسم.</summary>
public static class WorkflowSectionHelper
{
    public sealed class FormSectionItem
    {
        public int Id { get; set; }
        public string Title { get; set; } = "";
    }

    public static List<FormSectionItem> ParseSections(string? fieldsJson)
    {
        var sections = new List<FormSectionItem>();
        if (string.IsNullOrWhiteSpace(fieldsJson)) return sections;
        try
        {
            using var doc = JsonDocument.Parse(fieldsJson);
            var root = doc.RootElement;
            if (root.ValueKind == JsonValueKind.Array)
            {
                sections.Add(new FormSectionItem { Id = 1, Title = "القسم الأول" });
                return sections;
            }
            if (root.ValueKind == JsonValueKind.Object
                && root.TryGetProperty("sections", out var secEl)
                && secEl.ValueKind == JsonValueKind.Array)
            {
                var idx = 0;
                foreach (var s in secEl.EnumerateArray())
                {
                    idx++;
                    var id = idx;
                    if (s.TryGetProperty("id", out var idEl) && idEl.TryGetInt32(out var parsedId))
                        id = parsedId;
                    var title = s.TryGetProperty("title", out var tEl) ? (tEl.GetString() ?? "") : "";
                    if (string.IsNullOrWhiteSpace(title)) title = $"القسم {idx}";
                    sections.Add(new FormSectionItem { Id = id, Title = title.Trim() });
                }
            }
        }
        catch { /* ignore */ }
        return sections;
    }

    /// <summary>
    /// يُكمّل معرّف النموذج/القسم تلقائياً عند وجود نموذج واحد أو قسم واحد.
    /// </summary>
    public static (int? FormDefinitionId, int? FormSectionId) ResolveStepBinding(
        int? formDefinitionId,
        int? formSectionId,
        IReadOnlyList<int> usedFormIds,
        IReadOnlyDictionary<int, FormDefinition> fdById)
    {
        var fid = formDefinitionId;
        if ((!fid.HasValue || fid.Value <= 0) && usedFormIds.Count == 1)
            fid = usedFormIds[0];

        if (!fid.HasValue || fid.Value <= 0)
            return (null, null);

        if (!fdById.TryGetValue(fid.Value, out var fd))
            return (fid, formSectionId);

        var sections = ParseSections(fd.FieldsJson);
        if (sections.Count == 1)
            return (fid, sections[0].Id);

        if (sections.Count > 1 && formSectionId.HasValue && formSectionId.Value > 0)
            return (fid, formSectionId);

        return (fid, formSectionId);
    }

    public static string? SectionTitle(FormDefinition fd, int sectionId)
    {
        var sec = ParseSections(fd.FieldsJson).FirstOrDefault(s => s.Id == sectionId);
        return sec?.Title;
    }

    public static HashSet<int> FieldIdsInSection(string? fieldsJson, int sectionId)
    {
        var ids = new HashSet<int>();
        if (string.IsNullOrWhiteSpace(fieldsJson) || sectionId <= 0) return ids;
        try
        {
            using var doc = JsonDocument.Parse(fieldsJson);
            var root = doc.RootElement;
            IEnumerable<JsonElement> fields;
            if (root.ValueKind == JsonValueKind.Array)
                fields = root.EnumerateArray();
            else if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("fields", out var fEl) && fEl.ValueKind == JsonValueKind.Array)
                fields = fEl.EnumerateArray();
            else return ids;

            foreach (var f in fields)
            {
                var sid = 1;
                if (f.TryGetProperty("sectionId", out var sEl) && sEl.TryGetInt32(out var parsed))
                    sid = parsed;
                if (sid != sectionId) continue;
                if (f.TryGetProperty("id", out var idEl) && idEl.TryGetInt32(out var fid))
                    ids.Add(fid);
            }
        }
        catch { /* ignore */ }
        return ids;
    }
}
