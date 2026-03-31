namespace FormsSystem.Models.Entities;

public class BackupRecord
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string BackupType { get; set; } = "";
    public long SizeBytes { get; set; }
    public string CreatedBy { get; set; } = "";
    public string FilePath  { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public string SizeDisplay => SizeBytes switch
    {
        >= 1_073_741_824 => $"{SizeBytes / 1_073_741_824.0:F1} GB",
        >= 1_048_576 => $"{SizeBytes / 1_048_576.0:F1} MB",
        >= 1_024 => $"{SizeBytes / 1_024.0:F1} KB",
        _ => $"{SizeBytes} B"
    };
}
