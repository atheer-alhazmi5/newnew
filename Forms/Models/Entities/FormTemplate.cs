namespace FormsSystem.Models.Entities;

public class FormTemplate
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string Color { get; set; } = "#25935F";
    public bool IsActive { get; set; } = true;

    // Header & Footer stored as JSON strings
    public string HeaderJson { get; set; } = "[]";
    public string FooterJson { get; set; } = "[]";
    public int HeaderSections { get; set; } = 1;
    public int FooterSections { get; set; } = 1;

    // Page settings
    public int MarginTop { get; set; } = 20;
    public int MarginBottom { get; set; } = 20;
    public int MarginRight { get; set; } = 20;
    public int MarginLeft { get; set; } = 20;
    public string PageDirection { get; set; } = "RTL";
    public string PageSize { get; set; } = "A4";
    public bool ShowHeaderLine { get; set; } = true;
    public bool ShowFooterLine { get; set; } = true;

    public string CreatedBy { get; set; } = "";
    public string UpdatedBy { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
