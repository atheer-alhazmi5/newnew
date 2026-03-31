namespace FormsSystem.Models.Entities;

public class LoginAttempt
{
    public int Id { get; set; }
    public string UsernameAttempted { get; set; } = "";
    public string NationalId { get; set; } = "";
    public string FullName { get; set; } = "";
    public string OrganizationalUnit { get; set; } = "";
    public string WarningType { get; set; } = "";
    public string Severity { get; set; } = "Low";
    public string Description { get; set; } = "";
    public string IpAddress { get; set; } = "";
    public string Browser { get; set; } = "";
    public string OperatingSystem { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
