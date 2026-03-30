using System.Globalization;
using FormsSystem.Data;
using FormsSystem.Models.Entities;
using FormsSystem.Models.Enums;

namespace FormsSystem.Services;

public class DataService
{
    private readonly AppDbContext _db;
    private readonly PasswordService _pw;

    public DataService(AppDbContext db, PasswordService pw)
    {
        _db = db;
        _pw = pw;
    }

    private static readonly List<DirectoryLookupResult> _directoryUsers = new()
    {
        new() { NationalId = "1010101010", FullName = "أثير علي الحازمي", Email = "atheer@emirate.gov.sa", Phone = "0551234567", DepartmentName = "إدارة تقنية المعلومات", PhotoUrl = "" },
        new() { NationalId = "1020202020", FullName = "روان خالد التميمي", Email = "rawan@emirate.gov.sa", Phone = "0557654321", DepartmentName = "إدارة تقنية المعلومات", PhotoUrl = "" },
        new() { NationalId = "1030303030", FullName = "أمل سلمي الرحيلي", Email = "amal@emirate.gov.sa", Phone = "0553456789", DepartmentName = "إدارة تقنية المعلومات", PhotoUrl = "" }
    };

    // ─── SEED ─────────────────────────────────────────────────────────────────
    public Task SeedDataIfEmptyAsync()
    {
        if (!_db.IsEmpty()) return Task.CompletedTask;

        var depts = new List<Department>
        {
            new() { Id=1, Name="الإدارة العامة للموارد البشرية", Code="HR", CreatedAt=DateTime.Now },
            new() { Id=2, Name="الإدارة العامة لتقنية المعلومات والتحول الرقمي", Code="IT_DIGITAL", CreatedAt=DateTime.Now },
            new() { Id=3, Name="إدارة تقنية المعلومات", Code="IT", CreatedAt=DateTime.Now }
        };
        _db.SaveDepartments(depts);

        var cats = new List<FormCategory>
        {
            new() { Id=1, Name="نموذج نظام", CreatedAt=DateTime.Now },
            new() { Id=2, Name="تقرير دوري", CreatedAt=DateTime.Now },
            new() { Id=3, Name="طلب إداري", CreatedAt=DateTime.Now },
            new() { Id=4, Name="استبيان عام", CreatedAt=DateTime.Now }
        };
        _db.SaveFormCategories(cats);

        var users = new List<User>
        {
            new() { Id=1, Username="admin", Email="majed@emirate.gov.sa",
                    FullName="ماجد مرزوق لاحق الحسيني",
                    PasswordHash=_pw.Hash("admin123"), Role=UserRole.Admin, DepartmentId=3, CreatedAt=DateTime.Now },
            new() { Id=2, Username="atheer", Email="atheer@emirate.gov.sa",
                    FullName="أثير علي الحازمي",
                    PasswordHash=_pw.Hash("password123"), Role=UserRole.Manager, DepartmentId=3, CreatedAt=DateTime.Now },
            new() { Id=3, Username="rawan", Email="rawan@emirate.gov.sa",
                    FullName="روان خالد التميمي",
                    PasswordHash=_pw.Hash("password123"), Role=UserRole.Employee, DepartmentId=3, CreatedAt=DateTime.Now },
            new() { Id=4, Username="amal", Email="amal@emirate.gov.sa",
                    FullName="أمل سلمي الرحيلي",
                    PasswordHash=_pw.Hash("password123"), Role=UserRole.Employee, DepartmentId=3, CreatedAt=DateTime.Now },
            new() { Id=5, Username="nujood", Email="nujood@emirate.gov.sa",
                    FullName="نجود الرشيدي",
                    PasswordHash=_pw.Hash("password123"), Role=UserRole.Staff, DepartmentId=3, CreatedAt=DateTime.Now }
        };
        _db.SaveUsers(users);

        var forms = new List<Form>
        {
            new() {
                Id=1, Name="نموذج نقل المعرفة",
                Description="نموذج توثيق ونقل المعرفة بين الموظفين والإدارات",
                Icon="document", Type="ready_made", Category="نموذج نظام", CategoryId=1,
                CreatedBy="النظام", CreatedByDepartment="إدارة تقنية المعلومات",
                SectionsJson="""[{"id":1,"title":"بيانات الناقل","questions":[{"id":1,"text":"اسم الموظف الناقل للمعرفة","type":"short_answer","required":true,"options":[]},{"id":2,"text":"الإدارة / القسم","type":"short_answer","required":true,"options":[]},{"id":3,"text":"المسمى الوظيفي","type":"short_answer","required":true,"options":[]},{"id":4,"text":"تاريخ النقل","type":"date_only","required":true,"options":[]}]},{"id":2,"title":"تفاصيل المعرفة","questions":[{"id":5,"text":"عنوان المعرفة المنقولة","type":"short_answer","required":true,"options":[]},{"id":6,"text":"وصف تفصيلي للمعرفة","type":"paragraph","required":true,"options":[]},{"id":7,"text":"نوع المعرفة","type":"multiple_choice","required":true,"options":["إجرائية","تقنية","إدارية","فنية"]},{"id":8,"text":"الفئة المستهدفة","type":"checkboxes","required":true,"options":["موظفين جدد","نفس الإدارة","إدارات أخرى","جميع الموظفين"]},{"id":9,"text":"المرفقات والوثائق الداعمة","type":"file_upload","required":false,"options":[]},{"id":10,"text":"ملاحظات إضافية","type":"paragraph","required":false,"options":[]}]}]""",
                CreatedAt=DateTime.Now
            },
            new() {
                Id=2, Name="طلب انتداب رسمي",
                Description="نموذج طلب الانتداب والسفر الرسمي",
                Icon="plane", Type="ready_made", Category="طلب إداري", CategoryId=3,
                CreatedBy="النظام", CreatedByDepartment="إدارة تقنية المعلومات",
                SectionsJson="""[{"id":1,"title":"بيانات الموظف","questions":[{"id":1,"text":"الاسم الرباعي","type":"short_answer","required":true,"options":[]},{"id":2,"text":"الرقم الوظيفي","type":"short_answer","required":true,"options":[]},{"id":3,"text":"الإدارة / القسم","type":"short_answer","required":true,"options":[]}]},{"id":2,"title":"تفاصيل الانتداب","questions":[{"id":4,"text":"جهة الانتداب","type":"short_answer","required":true,"options":[]},{"id":5,"text":"مدينة الانتداب","type":"short_answer","required":true,"options":[]},{"id":6,"text":"الغرض من الانتداب","type":"paragraph","required":true,"options":[]},{"id":7,"text":"تاريخ بداية الانتداب","type":"date_only","required":true,"options":[]},{"id":8,"text":"تاريخ نهاية الانتداب","type":"date_only","required":true,"options":[]},{"id":9,"text":"وسيلة النقل","type":"dropdown","required":true,"options":["طيران","سيارة حكومية","سيارة خاصة","قطار"]},{"id":10,"text":"هل يتطلب حجز فندقي؟","type":"multiple_choice","required":true,"options":["نعم","لا"]},{"id":11,"text":"ملاحظات إضافية","type":"paragraph","required":false,"options":[]}]}]""",
                CreatedAt=DateTime.Now
            },
            new() {
                Id=3, Name="نموذج ابتكار",
                Description="نموذج تقديم فكرة ابتكارية لتطوير العمل",
                Icon="chart", Type="ready_made", Category="نموذج نظام", CategoryId=1,
                CreatedBy="النظام", CreatedByDepartment="إدارة تقنية المعلومات",
                SectionsJson="""[{"id":1,"title":"بيانات صاحب الفكرة","questions":[{"id":1,"text":"اسم الموظف","type":"short_answer","required":true,"options":[]},{"id":2,"text":"الإدارة / القسم","type":"short_answer","required":true,"options":[]},{"id":3,"text":"البريد الإلكتروني","type":"short_answer","required":true,"options":[]}]},{"id":2,"title":"تفاصيل الفكرة الابتكارية","questions":[{"id":4,"text":"عنوان الفكرة","type":"short_answer","required":true,"options":[]},{"id":5,"text":"وصف الفكرة بالتفصيل","type":"paragraph","required":true,"options":[]},{"id":6,"text":"المشكلة التي تعالجها الفكرة","type":"paragraph","required":true,"options":[]},{"id":7,"text":"الفوائد المتوقعة","type":"paragraph","required":true,"options":[]},{"id":8,"text":"مجال الابتكار","type":"dropdown","required":true,"options":["تحسين إجراءات","تقنية معلومات","خدمة المستفيدين","بيئة العمل","أخرى"]},{"id":9,"text":"هل تحتاج الفكرة لميزانية؟","type":"multiple_choice","required":true,"options":["نعم","لا","غير متأكد"]},{"id":10,"text":"مرفقات توضيحية (إن وجدت)","type":"file_upload","required":false,"options":[]}]}]""",
                CreatedAt=DateTime.Now
            },
            new() {
                Id=4, Name="محضر اجتماع",
                Description="نموذج توثيق محاضر الاجتماعات الرسمية",
                Icon="document", Type="ready_made", Category="تقرير دوري", CategoryId=2,
                CreatedBy="النظام", CreatedByDepartment="إدارة تقنية المعلومات",
                SectionsJson="""[{"id":1,"title":"بيانات الاجتماع","questions":[{"id":1,"text":"عنوان الاجتماع","type":"short_answer","required":true,"options":[]},{"id":2,"text":"تاريخ الاجتماع","type":"date_only","required":true,"options":[]},{"id":3,"text":"وقت البداية","type":"short_answer","required":true,"options":[]},{"id":4,"text":"وقت النهاية","type":"short_answer","required":true,"options":[]},{"id":5,"text":"مكان الاجتماع","type":"short_answer","required":true,"options":[]},{"id":6,"text":"رئيس الاجتماع","type":"short_answer","required":true,"options":[]}]},{"id":2,"title":"الحضور والمحتوى","questions":[{"id":7,"text":"أسماء الحاضرين","type":"paragraph","required":true,"options":[]},{"id":8,"text":"أسماء المعتذرين","type":"paragraph","required":false,"options":[]},{"id":9,"text":"جدول الأعمال","type":"paragraph","required":true,"options":[]},{"id":10,"text":"ملخص المناقشات","type":"paragraph","required":true,"options":[]},{"id":11,"text":"القرارات والتوصيات","type":"paragraph","required":true,"options":[]},{"id":12,"text":"المهام المطلوبة والمسؤول عنها","type":"paragraph","required":true,"options":[]},{"id":13,"text":"موعد الاجتماع القادم","type":"date_only","required":false,"options":[]},{"id":14,"text":"مرفقات","type":"file_upload","required":false,"options":[]}]}]""",
                CreatedAt=DateTime.Now
            }
        };
        _db.SaveForms(forms);

        var classifications = new List<Classification>
        {
            new() { Id=1, Name="إدارة رئيسية", Description="", SortOrder=1, IsActive=true, CreatedAt=DateTime.Now },
            new() { Id=2, Name="إدارة فرعية", Description="", SortOrder=2, IsActive=true, CreatedAt=DateTime.Now }
        };
        _db.SaveClassifications(classifications);

        var orgUnits = new List<OrganizationalUnit>
        {
            new() { Id=1, Name="إدارة الأنظمة والبرامج", ClassificationId=1, Level="رئيسي", SortOrder=1, CreatedAt=DateTime.Now },
            new() { Id=2, Name="الإدارة العامة للموارد البشرية", ClassificationId=1, Level="رئيسي", SortOrder=2, CreatedAt=DateTime.Now },
            new() { Id=3, Name="مكتب البيانات الوطنية", ClassificationId=1, Level="رئيسي", SortOrder=3, CreatedAt=DateTime.Now }
        };
        _db.SaveOrganizationalUnits(orgUnits);

        var readyTables = new List<ReadyTable>
        {
            new() { Id=1, Name="جدول ضباط الاتصال", Description="جدول بيانات ضباط الاتصال", SortOrder=1, RowCountMode="مقيد", MaxRows=50, OrganizationalUnitId=1, Ownership="خاص", IsActive=false, CreatedBy="ماجد مرزوق لاحق الحسيني", CreatedAt=DateTime.Now },
            new() { Id=2, Name="جدول بيانات فريق العمل", Description="جدول بيانات أعضاء فريق العمل", SortOrder=2, RowCountMode="مفتوح", OrganizationalUnitId=2, Ownership="عام", IsActive=true, CreatedBy="ماجد مرزوق لاحق الحسيني", CreatedAt=DateTime.Now },
            new() { Id=3, Name="جدول الكميات", Description="جدول تسجيل الكميات والمقادير", SortOrder=3, RowCountMode="مقيد", MaxRows=100, OrganizationalUnitId=3, Ownership="عام", IsActive=true, CreatedBy="ماجد مرزوق لاحق الحسيني", CreatedAt=DateTime.Now }
        };
        _db.SaveReadyTables(readyTables);

        var readyTableFields = new List<ReadyTableField>();
        readyTableFields.Add(new ReadyTableField { Id=1, ReadyTableId=1, FieldName="الاسم", FieldType="الاسم الكامل", SortOrder=1, IsRequired=true, TooltipText="أدخل الاسم الكامل" });
        readyTableFields.Add(new ReadyTableField { Id=2, ReadyTableId=1, FieldName="الهاتف", FieldType="رقم الهاتف", SortOrder=2, IsRequired=true, TooltipText="أدخل رقم الهاتف" });
        readyTableFields.Add(new ReadyTableField { Id=3, ReadyTableId=1, FieldName="البريد", FieldType="البريد الإلكتروني", SortOrder=3, IsRequired=false, TooltipText="أدخل البريد الإلكتروني" });
        readyTableFields.Add(new ReadyTableField { Id=4, ReadyTableId=1, FieldName="الوحدة", FieldType="نص قصير", SortOrder=4, IsRequired=true, TooltipText="أدخل اسم الوحدة" });
        readyTableFields.Add(new ReadyTableField { Id=5, ReadyTableId=2, FieldName="اسم العضو", FieldType="الاسم الكامل", SortOrder=1, IsRequired=true, TooltipText="أدخل اسم العضو" });
        readyTableFields.Add(new ReadyTableField { Id=6, ReadyTableId=2, FieldName="الدور", FieldType="نص قصير", SortOrder=2, IsRequired=true, TooltipText="أدخل الدور" });
        readyTableFields.Add(new ReadyTableField { Id=7, ReadyTableId=2, FieldName="التاريخ", FieldType="تاريخ", SortOrder=3, IsRequired=false, TooltipText="اختر التاريخ" });
        readyTableFields.Add(new ReadyTableField { Id=8, ReadyTableId=2, FieldName="الحالة", FieldType="قائمة منسدلة", SortOrder=4, IsRequired=true, TooltipText="اختر الحالة" });
        readyTableFields.Add(new ReadyTableField { Id=9, ReadyTableId=2, FieldName="ملاحظات", FieldType="نص طويل", SortOrder=5, IsRequired=false, TooltipText="أدخل ملاحظات" });
        readyTableFields.Add(new ReadyTableField { Id=10, ReadyTableId=3, FieldName="المادة", FieldType="نص قصير", SortOrder=1, IsRequired=true, TooltipText="أدخل اسم المادة" });
        readyTableFields.Add(new ReadyTableField { Id=11, ReadyTableId=3, FieldName="الكمية", FieldType="رقم", SortOrder=2, IsRequired=true, TooltipText="أدخل الكمية" });
        readyTableFields.Add(new ReadyTableField { Id=12, ReadyTableId=3, FieldName="الوحدة", FieldType="نص قصير", SortOrder=3, IsRequired=true, TooltipText="أدخل وحدة القياس" });
        readyTableFields.Add(new ReadyTableField { Id=13, ReadyTableId=3, FieldName="التاريخ", FieldType="تاريخ", SortOrder=4, IsRequired=false, TooltipText="اختر التاريخ" });
        _db.SaveReadyTableFields(readyTableFields);

        return Task.CompletedTask;
    }

    public Task SeedReadyTablesIfEmptyAsync()
    {
        if (_db.ReadyTables.Count > 0) return Task.CompletedTask;
        var units = _db.OrganizationalUnits.OrderBy(u => u.SortOrder).ToList();
        if (units.Count == 0) return Task.CompletedTask;
        var u1 = units.Count > 0 ? units[0].Id : units.First().Id;
        var u2 = units.Count > 1 ? units[1].Id : u1;
        var u3 = units.Count > 2 ? units[2].Id : u1;
        var adminName = _db.Users.FirstOrDefault(u => u.Role == UserRole.Admin)?.FullName ?? "مدير النظام";

        var readyTables = new List<ReadyTable>
        {
            new() { Id=1, Name="جدول ضباط الاتصال", Description="جدول بيانات ضباط الاتصال", SortOrder=1, RowCountMode="مقيد", MaxRows=50, OrganizationalUnitId=u1, Ownership="خاص", IsActive=false, CreatedBy=adminName, CreatedAt=DateTime.Now },
            new() { Id=2, Name="جدول بيانات فريق العمل", Description="جدول بيانات أعضاء فريق العمل", SortOrder=2, RowCountMode="مفتوح", OrganizationalUnitId=u2, Ownership="عام", IsActive=true, CreatedBy=adminName, CreatedAt=DateTime.Now },
            new() { Id=3, Name="جدول الكميات", Description="جدول تسجيل الكميات والمقادير", SortOrder=3, RowCountMode="مقيد", MaxRows=100, OrganizationalUnitId=u3, Ownership="عام", IsActive=true, CreatedBy=adminName, CreatedAt=DateTime.Now }
        };
        _db.SaveReadyTables(readyTables);

        var readyTableFields = new List<ReadyTableField>();
        readyTableFields.Add(new ReadyTableField { Id=1, ReadyTableId=1, FieldName="الاسم", FieldType="الاسم الكامل", SortOrder=1, IsRequired=true, TooltipText="أدخل الاسم الكامل" });
        readyTableFields.Add(new ReadyTableField { Id=2, ReadyTableId=1, FieldName="الهاتف", FieldType="رقم الهاتف", SortOrder=2, IsRequired=true, TooltipText="أدخل رقم الهاتف" });
        readyTableFields.Add(new ReadyTableField { Id=3, ReadyTableId=1, FieldName="البريد", FieldType="البريد الإلكتروني", SortOrder=3, IsRequired=false, TooltipText="أدخل البريد الإلكتروني" });
        readyTableFields.Add(new ReadyTableField { Id=4, ReadyTableId=1, FieldName="الوحدة", FieldType="نص قصير", SortOrder=4, IsRequired=true, TooltipText="أدخل اسم الوحدة" });
        readyTableFields.Add(new ReadyTableField { Id=5, ReadyTableId=2, FieldName="اسم العضو", FieldType="الاسم الكامل", SortOrder=1, IsRequired=true, TooltipText="أدخل اسم العضو" });
        readyTableFields.Add(new ReadyTableField { Id=6, ReadyTableId=2, FieldName="الدور", FieldType="نص قصير", SortOrder=2, IsRequired=true, TooltipText="أدخل الدور" });
        readyTableFields.Add(new ReadyTableField { Id=7, ReadyTableId=2, FieldName="التاريخ", FieldType="تاريخ", SortOrder=3, IsRequired=false, TooltipText="اختر التاريخ" });
        readyTableFields.Add(new ReadyTableField { Id=8, ReadyTableId=2, FieldName="الحالة", FieldType="قائمة منسدلة", SortOrder=4, IsRequired=true, TooltipText="اختر الحالة" });
        readyTableFields.Add(new ReadyTableField { Id=9, ReadyTableId=2, FieldName="ملاحظات", FieldType="نص طويل", SortOrder=5, IsRequired=false, TooltipText="أدخل ملاحظات" });
        readyTableFields.Add(new ReadyTableField { Id=10, ReadyTableId=3, FieldName="المادة", FieldType="نص قصير", SortOrder=1, IsRequired=true, TooltipText="أدخل اسم المادة" });
        readyTableFields.Add(new ReadyTableField { Id=11, ReadyTableId=3, FieldName="الكمية", FieldType="رقم", SortOrder=2, IsRequired=true, TooltipText="أدخل الكمية" });
        readyTableFields.Add(new ReadyTableField { Id=12, ReadyTableId=3, FieldName="الوحدة", FieldType="نص قصير", SortOrder=3, IsRequired=true, TooltipText="أدخل وحدة القياس" });
        readyTableFields.Add(new ReadyTableField { Id=13, ReadyTableId=3, FieldName="التاريخ", FieldType="تاريخ", SortOrder=4, IsRequired=false, TooltipText="اختر التاريخ" });
        _db.SaveReadyTableFields(readyTableFields);

        return Task.CompletedTask;
    }

    // ─── ID GENERATORS ────────────────────────────────────────────────────────
    private static int NextId<T>(List<T> list, Func<T, int> idSelector)
        => list.Count == 0 ? 1 : list.Max(idSelector) + 1;

    // ─── DEPARTMENTS ──────────────────────────────────────────────────────────
    public Task<List<Department>> ListDepartmentsAsync()
        => Task.FromResult(_db.Departments);

    public Task<Department?> GetDepartmentByIdAsync(int id)
        => Task.FromResult(_db.Departments.FirstOrDefault(d => d.Id == id));

    // ─── USERS ────────────────────────────────────────────────────────────────
    public Task<User?> GetUserByUsernameAsync(string username)
    {
        var users = _db.Users;
        var depts = _db.Departments;
        var u = users.FirstOrDefault(u => u.Username == username);
        if (u != null) u.Department = depts.FirstOrDefault(d => d.Id == u.DepartmentId);
        return Task.FromResult(u);
    }

    public Task<DirectoryLookupResult?> LookupDirectoryByNationalIdAsync(string nationalId)
    {
        if (string.IsNullOrWhiteSpace(nationalId))
            return Task.FromResult<DirectoryLookupResult?>(null);

        var normalized = nationalId.Trim();
        var hit = _directoryUsers.FirstOrDefault(d => d.NationalId == normalized);
        return Task.FromResult(hit);
    }

    public Task<User?> GetUserByIdAsync(int id)
    {
        var users = _db.Users;
        var depts = _db.Departments;
        var u = users.FirstOrDefault(u => u.Id == id);
        if (u != null) u.Department = depts.FirstOrDefault(d => d.Id == u.DepartmentId);
        return Task.FromResult(u);
    }

    public Task<List<User>> ListUsersAsync(int? deptId = null)
    {
        var users = _db.Users;
        var depts = _db.Departments;
        var filtered = deptId.HasValue ? users.Where(u => u.DepartmentId == deptId.Value).ToList() : users;
        foreach (var u in filtered)
            u.Department = depts.FirstOrDefault(d => d.Id == u.DepartmentId);
        return Task.FromResult(filtered);
    }

    public Task<User> AddUserAsync(User user)
    {
        var users = _db.Users;
        user.Id = NextId(users, u => u.Id);
        user.CreatedAt = DateTime.Now;
        users.Add(user);
        _db.SaveUsers(users);
        return Task.FromResult(user);
    }

    public Task<bool> UpdateUserAsync(User user)
    {
        var users = _db.Users;
        var idx = users.FindIndex(u => u.Id == user.Id);
        if (idx < 0) return Task.FromResult(false);
        users[idx] = user;
        _db.SaveUsers(users);
        return Task.FromResult(true);
    }

    public Task<bool> UpdateUserStatusAsync(int userId, AccountStatus status)
    {
        var users = _db.Users;
        var u = users.FirstOrDefault(u => u.Id == userId);
        if (u == null) return Task.FromResult(false);
        u.Status = status;
        _db.SaveUsers(users);
        return Task.FromResult(true);
    }

    // ─── CATEGORIES ───────────────────────────────────────────────────────────
    public Task<List<FormCategory>> ListCategoriesAsync()
        => Task.FromResult(_db.FormCategories);

    public Task<FormCategory> AddCategoryAsync(FormCategory cat)
    {
        var cats = _db.FormCategories;
        cat.Id = NextId(cats, c => c.Id);
        cat.CreatedAt = DateTime.Now;
        cats.Add(cat);
        _db.SaveFormCategories(cats);
        return Task.FromResult(cat);
    }

    public Task<bool> DeleteCategoryAsync(int id)
    {
        var cats = _db.FormCategories;
        var cat = cats.FirstOrDefault(c => c.Id == id);
        if (cat == null) return Task.FromResult(false);
        cats.Remove(cat);
        _db.SaveFormCategories(cats);
        return Task.FromResult(true);
    }

    // ─── FORMS ────────────────────────────────────────────────────────────────
    public Task<List<Form>> ListReadyFormsAsync()
        => Task.FromResult(_db.Forms.Where(f => f.Type == "ready_made").ToList());

    public Task<List<Form>> ListAllFormsAsync(string? type = null)
    {
        var forms = _db.Forms;
        if (!string.IsNullOrEmpty(type))
            return Task.FromResult(forms.Where(f => f.Type == type).ToList());
        return Task.FromResult(forms);
    }

    public Task<Form?> GetFormByIdAsync(int id)
        => Task.FromResult(_db.Forms.FirstOrDefault(f => f.Id == id));

    public Task<Form> AddFormAsync(Form form)
    {
        var forms = _db.Forms;
        form.Id = NextId(forms, f => f.Id);
        form.CreatedAt = DateTime.Now;
        forms.Add(form);
        _db.SaveForms(forms);
        return Task.FromResult(form);
    }

    public Task<bool> UpdateFormAsync(Form form)
    {
        var forms = _db.Forms;
        var idx = forms.FindIndex(f => f.Id == form.Id);
        if (idx < 0) return Task.FromResult(false);
        forms[idx] = form;
        _db.SaveForms(forms);
        return Task.FromResult(true);
    }

    public Task<bool> DeleteFormAsync(int id)
    {
        var forms = _db.Forms;
        var f = forms.FirstOrDefault(f => f.Id == id);
        if (f == null) return Task.FromResult(false);
        forms.Remove(f);
        _db.SaveForms(forms);

        var sent = _db.SentForms;
        sent.RemoveAll(s => s.FormId == id);
        _db.SaveSentForms(sent);

        var recv = _db.ReceivedForms;
        recv.RemoveAll(r => r.FormId == id);
        _db.SaveReceivedForms(recv);

        return Task.FromResult(true);
    }

    // ─── SENT FORMS ───────────────────────────────────────────────────────────
    public Task<List<SentForm>> ListSentFormsAsync(int senderId)
        => Task.FromResult(_db.SentForms.Where(s => s.SenderId == senderId)
            .OrderByDescending(s => s.SentDate).ToList());

    public Task<SentForm?> GetSentFormByIdAsync(int id)
        => Task.FromResult(_db.SentForms.FirstOrDefault(s => s.Id == id));

    public Task<SentForm> AddSentFormAsync(SentForm sf)
    {
        var list = _db.SentForms;
        sf.Id = NextId(list, s => s.Id);
        sf.SentDate = DateTime.Now;
        list.Add(sf);
        _db.SaveSentForms(list);
        return Task.FromResult(sf);
    }

    public Task<bool> UpdateSentFormAsync(SentForm sf)
    {
        var list = _db.SentForms;
        var idx = list.FindIndex(s => s.Id == sf.Id);
        if (idx < 0) return Task.FromResult(false);
        list[idx] = sf;
        _db.SaveSentForms(list);
        return Task.FromResult(true);
    }

    // ─── RECEIVED FORMS ───────────────────────────────────────────────────────
    public Task<List<ReceivedForm>> ListReceivedFormsAsync(int recipientId, string? category = null)
    {
        var list = _db.ReceivedForms.Where(r => r.RecipientId == recipientId);
        if (!string.IsNullOrEmpty(category))
            list = list.Where(r => r.Category == category);
        return Task.FromResult(list.OrderByDescending(r => r.SentDate).ToList());
    }

    public Task<List<ReceivedForm>> ListApprovalRequestsForManagerAsync(int managerId, int deptId)
    {
        // Manager sees approval requests sent to their department users or themselves
        var users = _db.Users.Where(u => u.DepartmentId == deptId).Select(u => u.Id).ToHashSet();
        users.Add(managerId);
        var list = _db.ReceivedForms
            .Where(r => users.Contains(r.RecipientId) && r.Category == "approval_request")
            .OrderByDescending(r => r.SentDate).ToList();
        return Task.FromResult(list);
    }

    public Task<ReceivedForm?> GetReceivedFormByIdAsync(int id)
        => Task.FromResult(_db.ReceivedForms.FirstOrDefault(r => r.Id == id));

    public Task<ReceivedForm> AddReceivedFormAsync(ReceivedForm rf)
    {
        var list = _db.ReceivedForms;
        rf.Id = NextId(list, r => r.Id);
        rf.SentDate = DateTime.Now;
        list.Add(rf);
        _db.SaveReceivedForms(list);
        return Task.FromResult(rf);
    }

    public Task<bool> UpdateReceivedFormAsync(ReceivedForm rf)
    {
        var list = _db.ReceivedForms;
        var idx = list.FindIndex(r => r.Id == rf.Id);
        if (idx < 0) return Task.FromResult(false);
        list[idx] = rf;
        _db.SaveReceivedForms(list);
        return Task.FromResult(true);
    }

    public Task MarkReceivedFormReadAsync(int id)
    {
        var list = _db.ReceivedForms;
        var rf = list.FirstOrDefault(r => r.Id == id);
        if (rf != null) { rf.IsRead = true; _db.SaveReceivedForms(list); }
        return Task.CompletedTask;
    }

    // ─── REPLIES ──────────────────────────────────────────────────────────────
    public Task<List<Reply>> ListRepliesForFormAsync(int receivedFormId)
        => Task.FromResult(_db.Replies.Where(r => r.ReceivedFormId == receivedFormId)
            .OrderBy(r => r.ReplyDate).ToList());

    public Task<Reply> AddReplyAsync(Reply reply)
    {
        var list = _db.Replies;
        reply.Id = NextId(list, r => r.Id);
        reply.ReplyDate = DateTime.Now;
        list.Add(reply);
        _db.SaveReplies(list);
        return Task.FromResult(reply);
    }

    // ─── NOTIFICATIONS ────────────────────────────────────────────────────────
    public Task<List<Notification>> ListNotificationsAsync(int recipientId)
        => Task.FromResult(_db.Notifications.Where(n => n.RecipientId == recipientId)
            .OrderByDescending(n => n.CreatedAt).ToList());

    public Task<int> GetUnreadCountAsync(int recipientId)
        => Task.FromResult(_db.Notifications.Count(n => n.RecipientId == recipientId && !n.IsRead));

    public Task CreateNotificationAsync(Notification n)
    {
        var list = _db.Notifications;
        n.Id = NextId(list, x => x.Id);
        n.CreatedAt = DateTime.Now;
        list.Add(n);
        _db.SaveNotifications(list);
        return Task.CompletedTask;
    }

    public Task MarkNotificationReadAsync(int id)
    {
        var list = _db.Notifications;
        var n = list.FirstOrDefault(x => x.Id == id);
        if (n != null) { n.IsRead = true; _db.SaveNotifications(list); }
        return Task.CompletedTask;
    }

    public Task MarkAllNotificationsReadAsync(int recipientId)
    {
        var list = _db.Notifications;
        list.Where(n => n.RecipientId == recipientId && !n.IsRead).ToList()
            .ForEach(n => n.IsRead = true);
        _db.SaveNotifications(list);
        return Task.CompletedTask;
    }

    public Task DeleteNotificationAsync(int id)
    {
        var list = _db.Notifications;
        var n = list.FirstOrDefault(x => x.Id == id);
        if (n != null) { list.Remove(n); _db.SaveNotifications(list); }
        return Task.CompletedTask;
    }

    // ─── CLASSIFICATIONS ──────────────────────────────────────────────────────
    public Task<List<Classification>> ListClassificationsAsync()
        => Task.FromResult(_db.Classifications.OrderBy(c => c.SortOrder).ToList());

    public Task<Classification?> GetClassificationByIdAsync(int id)
        => Task.FromResult(_db.Classifications.FirstOrDefault(c => c.Id == id));

    public Task<Classification> AddClassificationAsync(Classification cls)
    {
        var list = _db.Classifications;
        cls.Id = NextId(list, c => c.Id);
        cls.CreatedAt = DateTime.Now;
        list.Add(cls);
        _db.SaveClassifications(list);
        return Task.FromResult(cls);
    }

    public Task<bool> UpdateClassificationAsync(Classification cls)
    {
        var list = _db.Classifications;
        var idx = list.FindIndex(c => c.Id == cls.Id);
        if (idx < 0) return Task.FromResult(false);
        list[idx] = cls;
        _db.SaveClassifications(list);
        return Task.FromResult(true);
    }

    public Task<bool> DeleteClassificationAsync(int id)
    {
        var list = _db.Classifications;
        var cls = list.FirstOrDefault(c => c.Id == id);
        if (cls == null) return Task.FromResult(false);
        list.Remove(cls);
        _db.SaveClassifications(list);
        return Task.FromResult(true);
    }

    public Task<bool> IsClassificationLinkedAsync(int classificationId)
    {
        var linked = _db.Departments.Any(d => d.ClassificationId == classificationId);
        return Task.FromResult(linked);
    }

    public Task<bool> IsClassificationNameDuplicateAsync(string name, int? excludeId = null)
    {
        var list = _db.Classifications;
        var duplicate = list.Any(c => c.Name == name && (!excludeId.HasValue || c.Id != excludeId.Value));
        return Task.FromResult(duplicate);
    }

    public Task ReorderClassificationsAsync(int classificationId, int newOrder)
    {
        var list = _db.Classifications.OrderBy(c => c.SortOrder).ToList();
        var target = list.FirstOrDefault(c => c.Id == classificationId);
        if (target == null) return Task.CompletedTask;

        if (newOrder < 1) newOrder = 1;
        if (newOrder > list.Count) newOrder = list.Count;

        list.Remove(target);
        list.Insert(newOrder - 1, target);

        for (int i = 0; i < list.Count; i++)
            list[i].SortOrder = i + 1;

        _db.SaveClassifications(list);
        return Task.CompletedTask;
    }

    // ─── FORM CLASSES (أصناف النماذج) ───────────────────────────────────────────
    public Task<List<FormClass>> ListFormClassesAsync()
        => Task.FromResult(_db.FormClasses.OrderBy(c => c.SortOrder).ToList());

    public Task<FormClass?> GetFormClassByIdAsync(int id)
        => Task.FromResult(_db.FormClasses.FirstOrDefault(c => c.Id == id));

    public Task<FormClass> AddFormClassAsync(FormClass cls)
    {
        var list = _db.FormClasses;
        cls.Id = NextId(list, c => c.Id);
        cls.CreatedAt = DateTime.Now;
        list.Add(cls);
        _db.SaveFormClasses(list);
        return Task.FromResult(cls);
    }

    public Task<bool> UpdateFormClassAsync(FormClass cls)
    {
        var list = _db.FormClasses;
        var idx = list.FindIndex(c => c.Id == cls.Id);
        if (idx < 0) return Task.FromResult(false);
        list[idx] = cls;
        _db.SaveFormClasses(list);
        return Task.FromResult(true);
    }

    public Task<bool> DeleteFormClassAsync(int id)
    {
        var list = _db.FormClasses;
        var cls = list.FirstOrDefault(c => c.Id == id);
        if (cls == null) return Task.FromResult(false);
        list.Remove(cls);
        _db.SaveFormClasses(list);
        return Task.FromResult(true);
    }

    public Task<bool> IsFormClassNameDuplicateAsync(string name, int? excludeId = null)
    {
        var list = _db.FormClasses;
        var duplicate = list.Any(c => c.Name == name && (!excludeId.HasValue || c.Id != excludeId.Value));
        return Task.FromResult(duplicate);
    }

    public Task ReorderFormClassesAsync(int formClassId, int newOrder)
    {
        var list = _db.FormClasses.OrderBy(c => c.SortOrder).ToList();
        var target = list.FirstOrDefault(c => c.Id == formClassId);
        if (target == null) return Task.CompletedTask;

        if (newOrder < 1) newOrder = 1;
        if (newOrder > list.Count) newOrder = list.Count;

        list.Remove(target);
        list.Insert(newOrder - 1, target);

        for (int i = 0; i < list.Count; i++)
            list[i].SortOrder = i + 1;

        _db.SaveFormClasses(list);
        return Task.CompletedTask;
    }

    // ─── FORM SECTIONS (أنواع النماذج) ──────────────────────────────────────────
    public Task<List<FormSection>> ListFormSectionsAsync()
        => Task.FromResult(_db.FormSections.OrderBy(c => c.SortOrder).ToList());

    public Task<FormSection?> GetFormSectionByIdAsync(int id)
        => Task.FromResult(_db.FormSections.FirstOrDefault(c => c.Id == id));

    public Task<FormSection> AddFormSectionAsync(FormSection row)
    {
        var list = _db.FormSections;
        row.Id = NextId(list, c => c.Id);
        row.CreatedAt = DateTime.Now;
        list.Add(row);
        _db.SaveFormSections(list);
        return Task.FromResult(row);
    }

    public Task<bool> UpdateFormSectionAsync(FormSection row)
    {
        var list = _db.FormSections;
        var idx = list.FindIndex(c => c.Id == row.Id);
        if (idx < 0) return Task.FromResult(false);
        list[idx] = row;
        _db.SaveFormSections(list);
        return Task.FromResult(true);
    }

    public Task<bool> DeleteFormSectionAsync(int id)
    {
        var list = _db.FormSections;
        var row = list.FirstOrDefault(c => c.Id == id);
        if (row == null) return Task.FromResult(false);
        list.Remove(row);
        _db.SaveFormSections(list);
        return Task.FromResult(true);
    }

    public Task<bool> IsFormSectionNameDuplicateAsync(string name, int? excludeId = null)
    {
        var list = _db.FormSections;
        var n = name.Trim();
        var duplicate = list.Any(c =>
            string.Equals(c.Name.Trim(), n, StringComparison.Ordinal) &&
            (!excludeId.HasValue || c.Id != excludeId.Value));
        return Task.FromResult(duplicate);
    }

    public Task ReorderFormSectionsAsync(int formSectionId, int newOrder)
    {
        var list = _db.FormSections.OrderBy(c => c.SortOrder).ToList();
        var target = list.FirstOrDefault(c => c.Id == formSectionId);
        if (target == null) return Task.CompletedTask;

        if (newOrder < 1) newOrder = 1;
        if (newOrder > list.Count) newOrder = list.Count;

        list.Remove(target);
        list.Insert(newOrder - 1, target);

        for (int i = 0; i < list.Count; i++)
            list[i].SortOrder = i + 1;

        _db.SaveFormSections(list);
        return Task.CompletedTask;
    }

    // ─── FORM STATUSES (حالات النماذج) ───────────────────────────────────────
    public Task<List<FormStatus>> ListFormStatusesAsync()
        => Task.FromResult(_db.FormStatuses.OrderBy(s => s.SortOrder).ToList());

    public Task<FormStatus?> GetFormStatusByIdAsync(int id)
        => Task.FromResult(_db.FormStatuses.FirstOrDefault(s => s.Id == id));

    public Task<FormStatus> AddFormStatusAsync(FormStatus row)
    {
        var list = _db.FormStatuses;
        row.Id = NextId(list, s => s.Id);
        row.CreatedAt = DateTime.Now;
        list.Add(row);
        _db.SaveFormStatuses(list);
        return Task.FromResult(row);
    }

    public Task<bool> UpdateFormStatusAsync(FormStatus row)
    {
        var list = _db.FormStatuses;
        var idx = list.FindIndex(s => s.Id == row.Id);
        if (idx < 0) return Task.FromResult(false);
        list[idx] = row;
        _db.SaveFormStatuses(list);
        return Task.FromResult(true);
    }

    public Task<bool> DeleteFormStatusAsync(int id)
    {
        var list = _db.FormStatuses;
        var row = list.FirstOrDefault(s => s.Id == id);
        if (row == null) return Task.FromResult(false);
        list.Remove(row);
        _db.SaveFormStatuses(list);
        return Task.FromResult(true);
    }

    public Task<bool> IsFormStatusNameDuplicateAsync(string name, int? excludeId = null)
    {
        var list = _db.FormStatuses;
        var n = name.Trim();
        var duplicate = list.Any(s =>
            string.Equals(s.Name.Trim(), n, StringComparison.Ordinal) &&
            (!excludeId.HasValue || s.Id != excludeId.Value));
        return Task.FromResult(duplicate);
    }

    public Task ReorderFormStatusesAsync(int formStatusId, int newOrder)
    {
        var list = _db.FormStatuses.OrderBy(s => s.SortOrder).ToList();
        var target = list.FirstOrDefault(s => s.Id == formStatusId);
        if (target == null) return Task.CompletedTask;

        if (newOrder < 1) newOrder = 1;
        if (newOrder > list.Count) newOrder = list.Count;

        list.Remove(target);
        list.Insert(newOrder - 1, target);

        for (int i = 0; i < list.Count; i++)
            list[i].SortOrder = i + 1;

        _db.SaveFormStatuses(list);
        return Task.CompletedTask;
    }

    // ─── WORKSPACES ──────────────────────────────────────────────────────────
    public Task<List<Workspace>> ListWorkspacesAsync()
        => Task.FromResult(_db.Workspaces.OrderBy(w => w.SortOrder).ToList());

    public Task<Workspace?> GetWorkspaceByIdAsync(int id)
        => Task.FromResult(_db.Workspaces.FirstOrDefault(w => w.Id == id));

    public Task<Workspace> AddWorkspaceAsync(Workspace row)
    {
        var list = _db.Workspaces;
        row.Id = NextId(list, w => w.Id);
        row.CreatedAt = DateTime.Now;
        list.Add(row);
        _db.SaveWorkspaces(list);
        return Task.FromResult(row);
    }

    public Task<bool> UpdateWorkspaceAsync(Workspace row)
    {
        var list = _db.Workspaces;
        var idx = list.FindIndex(w => w.Id == row.Id);
        if (idx < 0) return Task.FromResult(false);
        list[idx] = row;
        _db.SaveWorkspaces(list);
        return Task.FromResult(true);
    }

    public Task<bool> DeleteWorkspaceAsync(int id)
    {
        var list = _db.Workspaces;
        var row = list.FirstOrDefault(w => w.Id == id);
        if (row == null) return Task.FromResult(false);
        list.Remove(row);
        _db.SaveWorkspaces(list);
        return Task.FromResult(true);
    }

    public Task<bool> IsWorkspaceNameDuplicateAsync(string name, int? excludeId = null)
    {
        var list = _db.Workspaces;
        var n = name.Trim();
        var duplicate = list.Any(w =>
            string.Equals(w.Name.Trim(), n, StringComparison.Ordinal) &&
            (!excludeId.HasValue || w.Id != excludeId.Value));
        return Task.FromResult(duplicate);
    }

    public Task ReorderWorkspacesAsync(int workspaceId, int newOrder)
    {
        var list = _db.Workspaces.OrderBy(w => w.SortOrder).ToList();
        var target = list.FirstOrDefault(w => w.Id == workspaceId);
        if (target == null) return Task.CompletedTask;

        if (newOrder < 1) newOrder = 1;
        if (newOrder > list.Count) newOrder = list.Count;

        list.Remove(target);
        list.Insert(newOrder - 1, target);

        for (int i = 0; i < list.Count; i++)
            list[i].SortOrder = i + 1;

        _db.SaveWorkspaces(list);
        return Task.CompletedTask;
    }

    // ─── ORGANIZATIONAL UNITS ────────────────────────────────────────────────
    public Task<List<OrganizationalUnit>> ListOrganizationalUnitsAsync()
        => Task.FromResult(_db.OrganizationalUnits.OrderBy(u => u.SortOrder).ToList());

    public Task<OrganizationalUnit?> GetOrganizationalUnitByIdAsync(int id)
        => Task.FromResult(_db.OrganizationalUnits.FirstOrDefault(u => u.Id == id));

    public Task<List<OrganizationalUnit>> ListMainUnitsAsync()
        => Task.FromResult(_db.OrganizationalUnits.Where(u => u.Level == "رئيسي").OrderBy(u => u.SortOrder).ToList());

    public Task<OrganizationalUnit> AddOrganizationalUnitAsync(OrganizationalUnit unit)
    {
        var list = _db.OrganizationalUnits;
        unit.Id = NextId(list, u => u.Id);
        unit.CreatedAt = DateTime.Now;
        list.Add(unit);
        _db.SaveOrganizationalUnits(list);
        return Task.FromResult(unit);
    }

    public Task<bool> UpdateOrganizationalUnitAsync(OrganizationalUnit unit)
    {
        var list = _db.OrganizationalUnits;
        var idx = list.FindIndex(u => u.Id == unit.Id);
        if (idx < 0) return Task.FromResult(false);
        list[idx] = unit;
        _db.SaveOrganizationalUnits(list);
        return Task.FromResult(true);
    }

    public Task<bool> DeleteOrganizationalUnitAsync(int id)
    {
        var list = _db.OrganizationalUnits;
        var unit = list.FirstOrDefault(u => u.Id == id);
        if (unit == null) return Task.FromResult(false);
        if (list.Any(u => u.ParentId == id))
            return Task.FromResult(false); // has children
        list.Remove(unit);
        _db.SaveOrganizationalUnits(list);
        return Task.FromResult(true);
    }

    public Task<bool> IsOrganizationalUnitNameDuplicateAsync(string name, int? excludeId = null)
    {
        var list = _db.OrganizationalUnits;
        var n = name.Trim();
        var duplicate = list.Any(u =>
            string.Equals(u.Name.Trim(), n, StringComparison.Ordinal) &&
            (!excludeId.HasValue || u.Id != excludeId.Value));
        return Task.FromResult(duplicate);
    }

    public Task<bool> IsOrganizationalUnitSortOrderTakenAsync(int sortOrder, int? excludeId = null)
    {
        var list = _db.OrganizationalUnits;
        return Task.FromResult(list.Any(u => u.SortOrder == sortOrder && (!excludeId.HasValue || u.Id != excludeId.Value)));
    }

    public Task ReorderOrganizationalUnitsAsync(int unitId, int newOrder)
    {
        var list = _db.OrganizationalUnits.OrderBy(u => u.SortOrder).ToList();
        var target = list.FirstOrDefault(u => u.Id == unitId);
        if (target == null) return Task.CompletedTask;
        if (newOrder < 1) newOrder = 1;
        if (newOrder > list.Count) newOrder = list.Count;
        list.Remove(target);
        list.Insert(newOrder - 1, target);
        for (int i = 0; i < list.Count; i++)
            list[i].SortOrder = i + 1;
        _db.SaveOrganizationalUnits(list);
        return Task.CompletedTask;
    }

    // ─── BENEFICIARIES ───────────────────────────────────────────────────────
    public Task<List<Beneficiary>> ListBeneficiariesAsync()
        => Task.FromResult(_db.Beneficiaries.OrderBy(b => b.Id).ToList());

    public Task<Beneficiary?> GetBeneficiaryByIdAsync(int id)
        => Task.FromResult(_db.Beneficiaries.FirstOrDefault(b => b.Id == id));

    public Task<Beneficiary?> GetBeneficiaryByNationalIdAsync(string nationalId, int? excludeId = null)
        => Task.FromResult(_db.Beneficiaries.FirstOrDefault(b => b.NationalId == nationalId && (!excludeId.HasValue || b.Id != excludeId.Value)));

    public Task<Beneficiary> AddBeneficiaryAsync(Beneficiary b)
    {
        var list = _db.Beneficiaries;
        b.Id = NextId(list, x => x.Id);
        b.CreatedAt = DateTime.Now;
        list.Add(b);
        _db.SaveBeneficiaries(list);
        return Task.FromResult(b);
    }

    public Task<bool> UpdateBeneficiaryAsync(Beneficiary b)
    {
        var list = _db.Beneficiaries;
        var idx = list.FindIndex(x => x.Id == b.Id);
        if (idx < 0) return Task.FromResult(false);
        list[idx] = b;
        _db.SaveBeneficiaries(list);
        return Task.FromResult(true);
    }

    public Task<bool> DeleteBeneficiaryAsync(int id)
    {
        var list = _db.Beneficiaries;
        var b = list.FirstOrDefault(x => x.Id == id);
        if (b == null) return Task.FromResult(false);
        list.Remove(b);
        _db.SaveBeneficiaries(list);
        return Task.FromResult(true);
    }

    public Task<Beneficiary?> GetBeneficiaryByEmailAsync(string email, int? excludeId = null)
        => Task.FromResult(_db.Beneficiaries.FirstOrDefault(b =>
            b.Email.Equals(email, StringComparison.OrdinalIgnoreCase)
            && (!excludeId.HasValue || b.Id != excludeId.Value)));

    public Task<Beneficiary?> GetBeneficiaryByPhoneAsync(string phone, int? excludeId = null)
    {
        var p = phone.Trim();
        return Task.FromResult(_db.Beneficiaries.FirstOrDefault(b =>
            b.Phone.Trim() == p && (!excludeId.HasValue || b.Id != excludeId.Value)));
    }

    // ─── DROPDOWN LISTS ───────────────────────────────────────────────────────
    public Task<List<DropdownList>> ListDropdownListsAsync()
        => Task.FromResult(_db.DropdownLists.OrderBy(d => d.SortOrder).ToList());

    public Task<DropdownList?> GetDropdownListByIdAsync(int id)
        => Task.FromResult(_db.DropdownLists.FirstOrDefault(d => d.Id == id));

    public Task<List<DropdownList>> ListIndependentDropdownListsAsync()
        => Task.FromResult(_db.DropdownLists.Where(d => d.ListType == "قائمة مستقلة").OrderBy(d => d.SortOrder).ToList());

    public Task<DropdownList> AddDropdownListAsync(DropdownList d)
    {
        var list = _db.DropdownLists;
        d.Id = NextId(list, x => x.Id);
        d.CreatedAt = DateTime.Now;
        list.Add(d);
        _db.SaveDropdownLists(list);
        return Task.FromResult(d);
    }

    public Task<bool> UpdateDropdownListAsync(DropdownList d)
    {
        var list = _db.DropdownLists;
        var idx = list.FindIndex(x => x.Id == d.Id);
        if (idx < 0) return Task.FromResult(false);
        list[idx] = d;
        list[idx].UpdatedAt = DateTime.Now;
        _db.SaveDropdownLists(list);
        return Task.FromResult(true);
    }

    public Task<bool> DeleteDropdownListAsync(int id)
    {
        var list = _db.DropdownLists;
        var d = list.FirstOrDefault(x => x.Id == id);
        if (d == null) return Task.FromResult(false);
        list.Remove(d);
        _db.SaveDropdownLists(list);
        var itemsList = _db.DropdownItems;
        itemsList.RemoveAll(i => i.DropdownListId == id);
        _db.SaveDropdownItems(itemsList);
        return Task.FromResult(true);
    }

    public Task<List<DropdownItem>> ListDropdownItemsByListIdAsync(int listId)
        => Task.FromResult(_db.DropdownItems.Where(i => i.DropdownListId == listId).OrderBy(i => i.SortOrder).ThenBy(i => i.Id).ToList());

    public Task<DropdownItem?> GetDropdownItemByIdAsync(int id)
        => Task.FromResult(_db.DropdownItems.FirstOrDefault(i => i.Id == id));

    public Task<DropdownItem> AddDropdownItemAsync(DropdownItem item)
    {
        var list = _db.DropdownItems;
        item.Id = NextId(list, x => x.Id);
        item.CreatedAt = DateTime.Now;
        list.Add(item);
        _db.SaveDropdownItems(list);
        return Task.FromResult(item);
    }

    public Task<bool> UpdateDropdownItemAsync(DropdownItem item)
    {
        var list = _db.DropdownItems;
        var idx = list.FindIndex(x => x.Id == item.Id);
        if (idx < 0) return Task.FromResult(false);
        list[idx] = item;
        list[idx].UpdatedAt = DateTime.Now;
        _db.SaveDropdownItems(list);
        return Task.FromResult(true);
    }

    public Task<bool> DeleteDropdownItemAsync(int id)
    {
        var list = _db.DropdownItems;
        var item = list.FirstOrDefault(x => x.Id == id);
        if (item == null) return Task.FromResult(false);
        list.Remove(item);
        _db.SaveDropdownItems(list);
        return Task.FromResult(true);
    }

    // ─── READY TABLES ─────────────────────────────────────────────────────────
    public Task<List<ReadyTable>> ListReadyTablesAsync()
        => Task.FromResult(_db.ReadyTables.OrderBy(t => t.SortOrder).ToList());

    public Task<ReadyTable?> GetReadyTableByIdAsync(int id)
        => Task.FromResult(_db.ReadyTables.FirstOrDefault(t => t.Id == id));

    public Task<ReadyTable> AddReadyTableAsync(ReadyTable t)
    {
        var list = _db.ReadyTables;
        t.Id = NextId(list, x => x.Id);
        t.CreatedAt = DateTime.Now;
        list.Add(t);
        _db.SaveReadyTables(list);
        return Task.FromResult(t);
    }

    public Task<bool> UpdateReadyTableAsync(ReadyTable t)
    {
        var list = _db.ReadyTables;
        var idx = list.FindIndex(x => x.Id == t.Id);
        if (idx < 0) return Task.FromResult(false);
        list[idx] = t;
        list[idx].UpdatedAt = DateTime.Now;
        _db.SaveReadyTables(list);
        return Task.FromResult(true);
    }

    public Task<bool> DeleteReadyTableAsync(int id)
    {
        var list = _db.ReadyTables;
        var t = list.FirstOrDefault(x => x.Id == id);
        if (t == null) return Task.FromResult(false);
        list.Remove(t);
        _db.SaveReadyTables(list);
        var fieldsList = _db.ReadyTableFields;
        fieldsList.RemoveAll(f => f.ReadyTableId == id);
        _db.SaveReadyTableFields(fieldsList);
        return Task.FromResult(true);
    }

    public Task<List<ReadyTableField>> ListReadyTableFieldsByTableIdAsync(int tableId)
        => Task.FromResult(_db.ReadyTableFields.Where(f => f.ReadyTableId == tableId).OrderBy(f => f.SortOrder).ToList());

    public Task<ReadyTableField> AddReadyTableFieldAsync(ReadyTableField f)
    {
        var list = _db.ReadyTableFields;
        f.Id = NextId(list, x => x.Id);
        list.Add(f);
        _db.SaveReadyTableFields(list);
        return Task.FromResult(f);
    }

    public Task<bool> UpdateReadyTableFieldAsync(ReadyTableField f)
    {
        var list = _db.ReadyTableFields;
        var idx = list.FindIndex(x => x.Id == f.Id);
        if (idx < 0) return Task.FromResult(false);
        list[idx] = f;
        _db.SaveReadyTableFields(list);
        return Task.FromResult(true);
    }

    public Task<bool> DeleteReadyTableFieldAsync(int id)
    {
        var list = _db.ReadyTableFields;
        var f = list.FirstOrDefault(x => x.Id == id);
        if (f == null) return Task.FromResult(false);
        list.Remove(f);
        _db.SaveReadyTableFields(list);
        return Task.FromResult(true);
    }

    // ─── AUDIT LOG ────────────────────────────────────────────────────────────
    public Task AddAuditLogAsync(AuditLog log)
    {
        var list = _db.AuditLogs;
        log.Id = NextId(list, a => a.Id);
        log.CreatedAt = DateTime.Now;
        list.Add(log);
        _db.SaveAuditLogs(list);
        return Task.CompletedTask;
    }

    public Task<List<AuditLog>> ListRecentAuditLogsAsync(int count = 20)
        => Task.FromResult(_db.AuditLogs.OrderByDescending(a => a.CreatedAt).Take(count).ToList());

    // ─── DASHBOARD ────────────────────────────────────────────────────────────
    public Task<(int approved, int sent, int pending, int inbox)> GetDashboardKpisAsync(int userId, int deptId)
    {
        var sent = _db.SentForms.Count(s => s.SenderId == userId);
        var inbox = _db.ReceivedForms.Count(r => r.RecipientId == userId && !r.IsRead);
        var pending = _db.SentForms.Count(s => s.SenderId == userId && s.Status == "pending_approval");
        var approved = _db.SentForms.Count(s => s.SenderId == userId && s.Status == "published");
        return Task.FromResult((approved, sent, pending, inbox));
    }

    // ─── ALIAS METHODS ────────────────────────────────────────────────────────
    public Task<List<Reply>> ListRepliesByFormIdAsync(int formId)
        => Task.FromResult(_db.Replies.Where(r => r.FormId == formId)
            .OrderBy(r => r.ReplyDate).ToList());

    public Task<Reply?> GetReplyByIdAsync(int id)
        => Task.FromResult(_db.Replies.FirstOrDefault(r => r.Id == id));

    public Task AddAuditLogAsync(int userId, string userName, string action, string entityType, string entityId, string details = "")
        => AddAuditLogAsync(new AuditLog { UserId = userId, UserName = userName, Action = action, EntityType = entityType, EntityId = entityId, Details = details });
}

public class DirectoryLookupResult
{
    public string NationalId { get; set; } = "";
    public string FullName { get; set; } = "";
    public string Email { get; set; } = "";
    public string Phone { get; set; } = "";
    public string DepartmentName { get; set; } = "";
    public string PhotoUrl { get; set; } = "";
}
