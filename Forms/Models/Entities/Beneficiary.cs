namespace FormsSystem.Models.Entities;

public class Beneficiary
{
    public int Id { get; set; }
    public string PhotoUrl { get; set; } = "";
    public string NationalId { get; set; } = "";
    public string EndorsementType { get; set; } = "";      // مرفق | التوقيع بالقلم
    public string EndorsementFile { get; set; } = "";
    public string SignatureType { get; set; } = "";        // مرفق | التوقيع بالقلم
    public string SignatureFile { get; set; } = "";
    public string FirstName { get; set; } = "";
    public string SecondName { get; set; } = "";
    public string ThirdName { get; set; } = "";
    public string FourthName { get; set; } = "";
    public int OrganizationalUnitId { get; set; }
    public string Phone { get; set; } = "";
    public string Email { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public string Username { get; set; } = "";
    public string MainRole { get; set; } = "";              // موظف | مدير
    public string SubRole { get; set; } = "";              // ممثل الوحدة التنظيمية | مدير النظام
    public string PasswordHash { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public string FullName => $"{FirstName} {SecondName} {ThirdName} {FourthName}".Trim();
    public string RoleDisplay => string.IsNullOrEmpty(SubRole) ? MainRole : $"{MainRole} - {SubRole}";
}
