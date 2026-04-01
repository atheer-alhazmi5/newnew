namespace FormsSystem.Models.Entities;

public class PopupNotification
{
    public int    Id            { get; set; }
    public string Title         { get; set; } = "";
    public string TitleFontSize { get; set; } = "18";   
    public string TitleColor    { get; set; } = "#1F2A37";
    public string Category      { get; set; } = "";     // إعلان | تنبيه
    public string ContentType   { get; set; } = "";     
    public string TextContent   { get; set; } = "";
    public string AttachmentUrl { get; set; } = "";     
    public string AttachmentMime{ get; set; } = "";     // image | video
    public string ExternalUrl   { get; set; } = "";
    public string DisplayPeriod { get; set; } = "permanent"; 
    public DateTime? StartDate  { get; set; }
    public DateTime? EndDate    { get; set; }
    public List<int> TargetUserIds       { get; set; } = new();
    public List<int> TargetDepartmentIds { get; set; } = new();
    public List<int> DismissedByUserIds  { get; set; } = new();
    public string DisplayLocation { get; set; } = "dashboard"; 
    public string Status          { get; set; } = "draft";     
    public string CreatedBy       { get; set; } = "";
    public DateTime CreatedAt     { get; set; } = DateTime.Now;
    public DateTime? PublishedAt  { get; set; }
}
