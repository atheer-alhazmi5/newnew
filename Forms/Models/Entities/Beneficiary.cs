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
    public bool IsUnitManager { get; set; } = false;        // مدير وحدة تنظيمية
    public string SubRole { get; set; } = "";              // ممثل الوحدة التنظيمية | مدير النظام
    public string PasswordHash { get; set; } = "";
    public string CreatedBy { get; set; } = "";
    public string? UpdatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public string FullName => $"{FirstName} {SecondName} {ThirdName} {FourthName}".Trim();
    public string RoleDisplay
    {
        get
        {
            var parts = new List<string> { "موظف" };
            if (IsUnitManager || MainRole == "مدير") parts.Add("مدير وحدة تنظيمية");
            if (!string.IsNullOrEmpty(SubRole)) parts.Add(SubRole);
            return string.Join(" - ", parts);
        }
    }
}
