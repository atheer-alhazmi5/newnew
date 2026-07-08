using FormsSystem.Models.Entities;

namespace FormsSystem.Services;

/// <summary>تحديد ما إذا كان النموذج مرتبطاً بقالب وبناء بيانات العرض.</summary>
public static class FormDefinitionTemplateHelper
{
    public static bool HasLinkedTemplate(FormDefinition? form) =>
        form != null && form.TemplateId > 0;

    public static bool HasTemplateSnapshotContent(FormDefinition form) =>
        HasNonEmptyJsonArray(form.TemplateHeaderJsonSnapshot)
        || HasNonEmptyJsonArray(form.TemplateFooterJsonSnapshot);

    private static bool HasNonEmptyJsonArray(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return false;
        var t = json.Trim();
        return t != "[]" && t != "{}";
    }

    /// <summary>يُرجع null عند «بدون قالب» (TemplateId = 0) حتى لا يُعرض رأس/تذييل/إطار وهمي.</summary>
    public static object? BuildTemplateData(FormDefinition fd, FormTemplate? liveTemplate)
    {
        if (!HasLinkedTemplate(fd)) return null;

        if (HasTemplateSnapshotContent(fd))
        {
            return new
            {
                Id = fd.TemplateId,
                Name = !string.IsNullOrWhiteSpace(fd.TemplateNameSnapshot) ? fd.TemplateNameSnapshot : (liveTemplate?.Name ?? ""),
                Color = !string.IsNullOrWhiteSpace(fd.TemplateColorSnapshot) ? fd.TemplateColorSnapshot : (liveTemplate?.Color ?? "#14573A"),
                HeaderJson = string.IsNullOrWhiteSpace(fd.TemplateHeaderJsonSnapshot) ? "[]" : fd.TemplateHeaderJsonSnapshot,
                HeaderBackgroundColor = fd.TemplateHeaderBackgroundColorSnapshot ?? "",
                HeaderBackgroundImageUrl = fd.TemplateHeaderBackgroundImageUrlSnapshot ?? "",
                FooterJson = string.IsNullOrWhiteSpace(fd.TemplateFooterJsonSnapshot) ? "[]" : fd.TemplateFooterJsonSnapshot,
                FooterBackgroundColor = fd.TemplateFooterBackgroundColorSnapshot ?? "",
                FooterBackgroundImageUrl = fd.TemplateFooterBackgroundImageUrlSnapshot ?? "",
                HeaderSections = 0,
                FooterSections = 0,
                MarginTop = fd.TemplateMarginTopSnapshot,
                MarginBottom = fd.TemplateMarginBottomSnapshot,
                MarginRight = fd.TemplateMarginRightSnapshot,
                MarginLeft = fd.TemplateMarginLeftSnapshot,
                PageDirection = string.IsNullOrWhiteSpace(fd.TemplatePageDirectionSnapshot) ? "RTL" : fd.TemplatePageDirectionSnapshot,
                ShowHeaderLine = fd.TemplateShowHeaderLineSnapshot,
                ShowFooterLine = fd.TemplateShowFooterLineSnapshot,
                WatermarkUrl = liveTemplate?.WatermarkUrl ?? "",
                WatermarkOpacity = liveTemplate?.WatermarkOpacity ?? 15
            };
        }

        if (liveTemplate != null)
        {
            return new
            {
                liveTemplate.Id,
                liveTemplate.Name,
                liveTemplate.Color,
                liveTemplate.HeaderJson,
                liveTemplate.HeaderBackgroundColor,
                liveTemplate.HeaderBackgroundImageUrl,
                liveTemplate.FooterJson,
                liveTemplate.FooterBackgroundColor,
                liveTemplate.FooterBackgroundImageUrl,
                liveTemplate.HeaderSections,
                liveTemplate.FooterSections,
                liveTemplate.MarginTop,
                liveTemplate.MarginBottom,
                liveTemplate.MarginRight,
                liveTemplate.MarginLeft,
                liveTemplate.PageDirection,
                liveTemplate.ShowHeaderLine,
                liveTemplate.ShowFooterLine,
                liveTemplate.WatermarkUrl,
                liveTemplate.WatermarkOpacity
            };
        }

        return null;
    }
}
