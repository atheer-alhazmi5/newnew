using System.Globalization;
using System.Text.Json;
using FormsSystem.Models.Entities;

namespace FormsSystem.Services;

/// <summary>تعبئة حقول «البيانات التلقائية للمستفيد» و«بيانات التصديق» في بيانات الطلب.</summary>
public static class FormAutoDataHelper
{
    public const string BeneficiaryAutoType = "البيانات التلقائية للمستفيد";
    public const string CertificationType = "بيانات التصديق";

    public static Dictionary<string, string> BuildProfileMap(Beneficiary? beneficiary, User user, string orgUnitName)
    {
        var honorific = (beneficiary?.Honorific ?? "").Trim();
        var org = (orgUnitName ?? "").Trim();
        var honorificOrgUnit = string.IsNullOrEmpty(honorific) && string.IsNullOrEmpty(org)
            ? ""
            : string.IsNullOrEmpty(honorific) ? org
            : string.IsNullOrEmpty(org) ? honorific
            : $"{honorific} — {org}";

        return new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["photo"] = (beneficiary?.PhotoUrl ?? user.PhotoUrl ?? "").Trim(),
            ["nationalId"] = (beneficiary?.NationalId ?? user.NationalId ?? "").Trim(),
            ["fullName"] = !string.IsNullOrWhiteSpace(beneficiary?.FullName) ? beneficiary!.FullName.Trim() : (user.FullName ?? "").Trim(),
            ["organizationalUnit"] = org,
            ["phone"] = (beneficiary?.Phone ?? user.Phone ?? "").Trim(),
            ["email"] = (beneficiary?.Email ?? user.Email ?? "").Trim(),
            ["gender"] = (beneficiary?.Gender ?? "").Trim(),
            ["dateOfBirth"] = beneficiary?.DateOfBirth?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) ?? "",
            ["employeeNumber"] = (beneficiary?.EmployeeNumber ?? "").Trim(),
            ["rank"] = (beneficiary?.Rank ?? "").Trim(),
            ["jobTitle"] = (beneficiary?.JobTitle ?? "").Trim(),
            ["jobNumber"] = (beneficiary?.JobNumber ?? "").Trim(),
            ["educationQualification"] = (beneficiary?.EducationQualification ?? "").Trim(),
            ["maritalStatus"] = (beneficiary?.MaritalStatus ?? "").Trim(),
            ["honorific"] = honorific,
            ["honorificOrgUnit"] = honorificOrgUnit,
            ["signature"] = (beneficiary?.SignatureFile ?? "").Trim(),
            ["todayDate"] = DateTime.Now.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)
        };
    }

    public static string EnrichSubmitFormDataJson(string formDataJson, string? formDefinitionFieldsJson, Dictionary<string, string> profileMap)
    {
        if (string.IsNullOrWhiteSpace(formDataJson)) return formDataJson;
        var defFields = ParseDefinitionFields(formDefinitionFieldsJson);
        if (defFields.Count == 0) return formDataJson;

        try
        {
            using var doc = JsonDocument.Parse(formDataJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return formDataJson;

            using var stream = new MemoryStream();
            using (var writer = new Utf8JsonWriter(stream, new JsonWriterOptions { Indented = false }))
            {
                writer.WriteStartObject();
                foreach (var prop in doc.RootElement.EnumerateObject())
                {
                    if (prop.NameEquals("fields") && prop.Value.ValueKind == JsonValueKind.Array)
                    {
                        writer.WritePropertyName("fields");
                        writer.WriteStartArray();
                        foreach (var entry in prop.Value.EnumerateArray())
                        {
                            writer.WriteStartObject();
                            foreach (var ep in entry.EnumerateObject())
                            {
                                if (ep.NameEquals("value"))
                                {
                                    var fieldId = entry.TryGetProperty("id", out var idEl) && idEl.TryGetInt64(out var fid) ? fid : 0;
                                    var fieldType = entry.TryGetProperty("fieldType", out var ftEl) ? ftEl.GetString() ?? "" : "";
                                    var def = defFields.FirstOrDefault(d => d.Id == fieldId);
                                    var type = !string.IsNullOrEmpty(fieldType) ? fieldType : def?.FieldType ?? "";
                                    if (type == BeneficiaryAutoType && def != null)
                                    {
                                        WriteAutoValue(writer, "value", ResolveSelectedValues(def.PropertiesJson, profileMap, BeneficiaryAutoType));
                                        continue;
                                    }
                                    if (type == CertificationType && def != null)
                                    {
                                        WriteAutoValue(writer, "value", ResolveEmptyCertificationValues(def.PropertiesJson));
                                        continue;
                                    }
                                }
                                writer.WritePropertyName(ep.Name);
                                ep.Value.WriteTo(writer);
                            }
                            writer.WriteEndObject();
                        }
                        writer.WriteEndArray();
                    }
                    else
                    {
                        writer.WritePropertyName(prop.Name);
                        prop.Value.WriteTo(writer);
                    }
                }
                writer.WriteEndObject();
            }
            return System.Text.Encoding.UTF8.GetString(stream.ToArray());
        }
        catch
        {
            return formDataJson;
        }
    }

    public static string MergeCertificationOnApprove(string formDataJson, string? formDefinitionFieldsJson, Dictionary<string, string> certifierProfileMap, HashSet<long>? limitToFieldIds = null)
    {
        if (string.IsNullOrWhiteSpace(formDataJson)) return formDataJson;
        var defFields = ParseDefinitionFields(formDefinitionFieldsJson);
        if (defFields.Count == 0) return formDataJson;

        try
        {
            using var doc = JsonDocument.Parse(formDataJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return formDataJson;

            using var stream = new MemoryStream();
            using (var writer = new Utf8JsonWriter(stream, new JsonWriterOptions { Indented = false }))
            {
                writer.WriteStartObject();
                foreach (var prop in doc.RootElement.EnumerateObject())
                {
                    if (prop.NameEquals("fields") && prop.Value.ValueKind == JsonValueKind.Array)
                    {
                        writer.WritePropertyName("fields");
                        writer.WriteStartArray();
                        foreach (var entry in prop.Value.EnumerateArray())
                        {
                            writer.WriteStartObject();
                            foreach (var ep in entry.EnumerateObject())
                            {
                                if (ep.NameEquals("value"))
                                {
                                    var fieldId = entry.TryGetProperty("id", out var idEl) && idEl.TryGetInt64(out var fid) ? fid : 0;
                                    if (limitToFieldIds != null && fieldId > 0 && !limitToFieldIds.Contains(fieldId))
                                    {
                                        writer.WritePropertyName(ep.Name);
                                        ep.Value.WriteTo(writer);
                                        continue;
                                    }
                                    var fieldType = entry.TryGetProperty("fieldType", out var ftEl) ? ftEl.GetString() ?? "" : "";
                                    var def = defFields.FirstOrDefault(d => d.Id == fieldId);
                                    var type = !string.IsNullOrEmpty(fieldType) ? fieldType : def?.FieldType ?? "";
                                    if (type == CertificationType && def != null)
                                    {
                                        WriteAutoValue(writer, "value", ResolveSelectedValues(def.PropertiesJson, certifierProfileMap, CertificationType));
                                        continue;
                                    }
                                }
                                writer.WritePropertyName(ep.Name);
                                ep.Value.WriteTo(writer);
                            }
                            writer.WriteEndObject();
                        }
                        writer.WriteEndArray();
                    }
                    else
                    {
                        writer.WritePropertyName(prop.Name);
                        prop.Value.WriteTo(writer);
                    }
                }
                writer.WriteEndObject();
            }
            return System.Text.Encoding.UTF8.GetString(stream.ToArray());
        }
        catch
        {
            return formDataJson;
        }
    }

    private static void WriteAutoValue(Utf8JsonWriter writer, string name, Dictionary<string, string> values)
    {
        writer.WritePropertyName(name);
        writer.WriteStartObject();
        foreach (var kv in values)
        {
            writer.WriteString(kv.Key, kv.Value);
        }
        writer.WriteEndObject();
    }

    private static Dictionary<string, string> ResolveSelectedValues(string? propertiesJson, Dictionary<string, string> profileMap, string fieldType)
    {
        var keys = ParseSelectedKeys(propertiesJson);
        var allowed = fieldType == CertificationType ? CertificationKeys : BeneficiaryKeys;
        var result = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var key in keys)
        {
            if (!allowed.Contains(key)) continue;
            result[key] = profileMap.TryGetValue(key, out var v) ? v : "";
        }
        return result;
    }

    private static Dictionary<string, string> ResolveEmptyCertificationValues(string? propertiesJson)
    {
        var keys = ParseSelectedKeys(propertiesJson);
        var result = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var key in keys)
        {
            if (CertificationKeys.Contains(key))
                result[key] = "";
        }
        return result;
    }

    private static List<string> ParseSelectedKeys(string? propertiesJson)
    {
        if (string.IsNullOrWhiteSpace(propertiesJson)) return new List<string>();
        try
        {
            using var doc = JsonDocument.Parse(propertiesJson);
            if (doc.RootElement.TryGetProperty("selectedKeys", out var sk))
            {
                if (sk.ValueKind == JsonValueKind.Array)
                    return sk.EnumerateArray().Select(e => e.GetString() ?? "").Where(s => !string.IsNullOrWhiteSpace(s)).ToList();
                if (sk.ValueKind == JsonValueKind.String)
                    return sk.GetString()?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList() ?? new List<string>();
            }
        }
        catch { /* ignore */ }
        return new List<string>();
    }

    private static List<DefField> ParseDefinitionFields(string? fieldsJson)
    {
        var list = new List<DefField>();
        if (string.IsNullOrWhiteSpace(fieldsJson)) return list;
        try
        {
            using var doc = JsonDocument.Parse(fieldsJson);
            JsonElement fieldsEl;
            if (doc.RootElement.ValueKind == JsonValueKind.Array)
                fieldsEl = doc.RootElement;
            else if (doc.RootElement.TryGetProperty("fields", out var f) && f.ValueKind == JsonValueKind.Array)
                fieldsEl = f;
            else
                return list;

            foreach (var item in fieldsEl.EnumerateArray())
            {
                if (!item.TryGetProperty("fieldType", out var ftEl)) continue;
                var ft = ftEl.GetString() ?? "";
                if (ft != BeneficiaryAutoType && ft != CertificationType) continue;
                long id = 0;
                if (item.TryGetProperty("id", out var idEl))
                {
                    if (idEl.ValueKind == JsonValueKind.Number) idEl.TryGetInt64(out id);
                    else if (idEl.ValueKind == JsonValueKind.String) long.TryParse(idEl.GetString(), out id);
                }
                var props = item.TryGetProperty("propertiesJson", out var pj) ? pj.GetString() : null;
                list.Add(new DefField { Id = id, FieldType = ft, PropertiesJson = props });
            }
        }
        catch { /* ignore */ }
        return list;
    }

    private static readonly HashSet<string> BeneficiaryKeys = new(StringComparer.Ordinal)
    {
        "photo", "nationalId", "fullName", "organizationalUnit", "phone", "email",
        "gender", "dateOfBirth", "employeeNumber", "rank", "jobTitle", "jobNumber",
        "educationQualification", "maritalStatus", "honorific"
    };

    private static readonly HashSet<string> CertificationKeys = new(StringComparer.Ordinal)
    {
        "honorificOrgUnit", "fullName", "signature", "todayDate"
    };

    private sealed class DefField
    {
        public long Id { get; set; }
        public string FieldType { get; set; } = "";
        public string? PropertiesJson { get; set; }
    }
}
