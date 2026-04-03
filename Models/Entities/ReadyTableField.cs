namespace FormsSystem.Models.Entities;

public class ReadyTableField
{
    public int Id { get; set; }
    public int ReadyTableId { get; set; }
    public string FieldName { get; set; } = "";
    public string FieldType { get; set; } = "نص قصير";
    public int SortOrder { get; set; }
    public bool IsRequired { get; set; }
    public string SubName { get; set; } = "";
    public string Placeholder { get; set; } = "";
    public string TooltipText { get; set; } = "";
    public string PropertiesJson { get; set; } = "{}";
}
