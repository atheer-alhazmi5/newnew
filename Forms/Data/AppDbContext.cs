using System.Text.Json;
using System.Text.Json.Serialization;
using FormsSystem.Models.Entities;
using FormsSystem.Models.Enums;

namespace FormsSystem.Data;

/// <summary>
/// JSON file-based data store (replaces EF Core for environments without NuGet access).
/// Drop-in compatible interface: async methods matching EF Core patterns.
/// </summary>
public class AppDbContext
{
    private readonly string _dataDir;
    private static readonly JsonSerializerOptions _opts = new()
    {
        WriteIndented = true,
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    public AppDbContext(IConfiguration config)
    {
        _dataDir = config["DataDir"] ?? Path.Combine(AppContext.BaseDirectory, "data");
        Directory.CreateDirectory(_dataDir);
    }

    // ── Generic helpers ────────────────────────────────────────────────
    private string FilePath(string name) => Path.Combine(_dataDir, $"{name}.json");

    private List<T> Load<T>(string name)
    {
        var path = FilePath(name);
        if (!File.Exists(path)) return new();
        try { return JsonSerializer.Deserialize<List<T>>(File.ReadAllText(path), _opts) ?? new(); }
        catch { return new(); }
    }

    private void Save<T>(string name, List<T> data)
        => File.WriteAllText(FilePath(name), JsonSerializer.Serialize(data, _opts));

    // ── Collections ───────────────────────────────────────────────────
    public List<Department>    Departments    => Load<Department>("departments");
    public List<User>          Users          => Load<User>("users");
    public List<FormCategory>  FormCategories => Load<FormCategory>("categories");
    public List<Form>          Forms          => Load<Form>("forms");
    public List<SentForm>      SentForms      => Load<SentForm>("sent_forms");
    public List<ReceivedForm>  ReceivedForms  => Load<ReceivedForm>("received_forms");
    public List<Reply>         Replies        => Load<Reply>("replies");
    public List<Notification>  Notifications  => Load<Notification>("notifications");
    public List<AuditLog>      AuditLogs      => Load<AuditLog>("audit_logs");
    public List<Classification> Classifications => Load<Classification>("classifications");
    public List<OrganizationalUnit> OrganizationalUnits => Load<OrganizationalUnit>("organizational_units");
    public List<Beneficiary> Beneficiaries => Load<Beneficiary>("beneficiaries");
    public List<DropdownList> DropdownLists => Load<DropdownList>("dropdown_lists");
    public List<DropdownItem> DropdownItems => Load<DropdownItem>("dropdown_items");
    public List<ReadyTable> ReadyTables => Load<ReadyTable>("ready_tables");
    public List<ReadyTableField> ReadyTableFields => Load<ReadyTableField>("ready_table_fields");

    // ── Mutation helpers ──────────────────────────────────────────────
    public void SaveDepartments(List<Department> d)    => Save("departments", d);
    public void SaveUsers(List<User> d)                => Save("users", d);
    public void SaveFormCategories(List<FormCategory> d) => Save("categories", d);
    public void SaveForms(List<Form> d)                => Save("forms", d);
    public void SaveSentForms(List<SentForm> d)        => Save("sent_forms", d);
    public void SaveReceivedForms(List<ReceivedForm> d) => Save("received_forms", d);
    public void SaveReplies(List<Reply> d)             => Save("replies", d);
    public void SaveNotifications(List<Notification> d) => Save("notifications", d);
    public void SaveAuditLogs(List<AuditLog> d)        => Save("audit_logs", d);
    public void SaveClassifications(List<Classification> d) => Save("classifications", d);
    public void SaveOrganizationalUnits(List<OrganizationalUnit> d) => Save("organizational_units", d);
    public void SaveBeneficiaries(List<Beneficiary> d) => Save("beneficiaries", d);
    public void SaveDropdownLists(List<DropdownList> d) => Save("dropdown_lists", d);
    public void SaveDropdownItems(List<DropdownItem> d) => Save("dropdown_items", d);
    public void SaveReadyTables(List<ReadyTable> d) => Save("ready_tables", d);
    public void SaveReadyTableFields(List<ReadyTableField> d) => Save("ready_table_fields", d);

    public bool IsEmpty() => !File.Exists(FilePath("departments"));
}
