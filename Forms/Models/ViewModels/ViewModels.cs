namespace FormsSystem.Models.ViewModels;

public class LoginVm
{
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
    public string? ErrorMessage { get; set; }
}

public class DashboardVm
{
    public int Approved { get; set; }
    public int Sent { get; set; }
    public int Pending { get; set; }
    public int Inbox { get; set; }
    public string DepartmentName { get; set; } = "";
    public string UserFullName { get; set; } = "";
}

public class FormListVm
{
    public string? SearchTerm { get; set; }
    public string? CategoryFilter { get; set; }
}

public class FormBuilderVm
{
    public int? EditFormId { get; set; }
}

public class FormFillVm
{
    public int FormId { get; set; }
    public int? ReceivedFormId { get; set; }
    public string Mode { get; set; } = "fill"; // fill | view | approve
}

public class InboxVm
{
    public string? CategoryFilter { get; set; }
    public string? StatusFilter { get; set; }
}

public class OutboxVm
{
    public string? StatusFilter { get; set; }
}

public class UsersVm
{
    public string? RoleFilter { get; set; }
    public string? DepartmentFilter { get; set; }
}

public class NotificationsVm
{
    public string? TypeFilter { get; set; }
}
