using FormsSystem.Models.Enums;

namespace FormsSystem.Models.Entities;

public class User
{
    public int Id { get; set; }
    public string NationalId { get; set; } = "";
    public string Username { get; set; } = "";
    public string Email { get; set; } = "";
    public string Phone { get; set; } = "";
    public string PhotoUrl { get; set; } = "";
    public string FullName { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public UserRole Role { get; set; }
    public int DepartmentId { get; set; }
    public Department? Department { get; set; }
    public AccountStatus Status { get; set; } = AccountStatus.Active;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public string RoleLabel => Role switch
    {
        UserRole.Admin => "مدير النظام",
        UserRole.Manager => "مدير الوحدة التنظيمية",
        UserRole.Employee => "ممثل وحدة تنظيمية",
        UserRole.Staff => "موظف",
        _ => ""
    };

    public string RoleName => Role.ToString();
}
