using System.Globalization;
using System.Text.Json;

namespace FormsSystem.Services;

/// <summary>
/// تحقق القيم المُرسلة وفق خصائص الحقل في التعريف — نفس رسائل الواجهة (معاينة الطرفية / التعبئة).
/// يُستدعى من مسار API حفظ الإجابات أو التحقق قبل الاعتماد النهائي.
/// </summary>
public static class InteractiveFieldAnswerValidator
{
    public static string RangeError(string minimumDisplay, string maximumDisplay) =>
        $"القيمة المدخلة يجب أن تتراوح بين \"{minimumDisplay}\" و \"{maximumDisplay}\"";

    public static string FileCountExceededMessage(int configuredMaxFiles) =>
        $"عدد الملفات المسموح بإرفاقها لا يتجاوز \"{configuredMaxFiles}\"";

    public static string FileSizeExceededMessage(double maxMegabytes) =>
        $"حجم الملفات المسموح بإرفاقها لا يتجاوز \"{FormatMb(maxMegabytes)}\"";

    private static string Disp(int? v) => v is null ? "—" : v.Value.ToString(CultureInfo.InvariantCulture);

    private static string Disp(double? v) => v is null ? "—" : FormatNum(v.Value);

    private static string FormatMb(double mb) => $"{FormatNum(mb)} ميغابايت";

    private static string FormatNum(double v) =>
        v.Equals(Math.Truncate(v))
            ? ((long)v).ToString(CultureInfo.InvariantCulture)
            : v.ToString(CultureInfo.InvariantCulture);

    /// <summary>أنواع تُقيَّم بطول المحتوى النصّي كما في الواجهة.</summary>
    public static readonly HashSet<string> TextLengthTypes = new(StringComparer.Ordinal)
    {
        "الاسم الكامل", "نص قصير", "رقم الهاتف", "البريد الإلكتروني", "نص طويل", "فقرة"
    };

    public static readonly HashSet<string> NumericRangeTypes = new(StringComparer.Ordinal)
    {
        "رقم", "دوار رقمي", "عملة"
    };

    public static string? ValidateAnswerValue(string fieldType, string? propertiesJson, string? rawValue)
    {
        var root = ParseProps(propertiesJson);

        if (TextLengthTypes.Contains(fieldType))
        {
            var min = TryInt(root, "minLength");
            int? max = TryInt(root, "maxLength");
            if (!max.HasValue && root.TryGetProperty("charLimit", out var cl)) max = TryIntFromElement(cl);
            return ValidateLengthBounds(min, max, rawValue ?? string.Empty);
        }

        if (NumericRangeTypes.Contains(fieldType))
        {
            var min = TryDouble(root, "minValue");
            var max = TryDouble(root, "maxValue");
            return ValidateNumericBounds(min, max, rawValue);
        }

        return null;
    }

    private static JsonElement ParseProps(string? json)
    {
        var raw = string.IsNullOrWhiteSpace(json) ? "{}" : json;
        try
        {
            using var d = JsonDocument.Parse(raw);
            return d.RootElement.Clone();
        }
        catch (JsonException)
        {
            using var d = JsonDocument.Parse("{}");
            return d.RootElement.Clone();
        }
    }

    public static string? ValidateLengthBounds(int? minLength, int? maxLength, string raw)
    {
        if (!minLength.HasValue && !maxLength.HasValue) return null;
        var len = raw.Length;
        if (minLength is not null && len < minLength) return RangeError(Disp(minLength), Disp(maxLength));
        if (maxLength is not null && len > maxLength) return RangeError(Disp(minLength), Disp(maxLength));
        return null;
    }

    public static string? ValidateNumericBounds(double? minValue, double? maxValue, string? rawValue)
    {
        if (!minValue.HasValue && !maxValue.HasValue) return null;
        var s = rawValue?.Trim() ?? string.Empty;
        if (string.IsNullOrEmpty(s)) return null;
        if (!double.TryParse(s.Replace(',', '.'), NumberStyles.Float, CultureInfo.InvariantCulture, out var n))
            return null;
        if (minValue is not null && n < minValue.Value) return RangeError(Disp(minValue), Disp(maxValue));
        if (maxValue is not null && n > maxValue.Value) return RangeError(Disp(minValue), Disp(maxValue));
        return null;
    }

    /// <param name="maxMegabytesPerFile">الحدّ الأقصى لحجم كل ملف (ميغابايت)، كما يخزَّن في التعريف.</param>
    public static string? ValidateFileSelection(int configuredMaxFiles, double? maxMegabytesPerFile, int fileCount, IEnumerable<long>? fileSizesBytes)
    {
        if (fileCount > configuredMaxFiles) return FileCountExceededMessage(configuredMaxFiles);

        if (maxMegabytesPerFile is { } mx && mx >= 0 && fileSizesBytes is not null)
        {
            var maxBytes = mx * 1024d * 1024d;
            foreach (var sz in fileSizesBytes)
                if (sz > maxBytes) return FileSizeExceededMessage(mx);
        }

        return null;
    }

    private static int? TryInt(JsonElement obj, string name)
        => obj.TryGetProperty(name, out var el) ? TryIntFromElement(el) : null;

    private static int? TryIntFromElement(JsonElement el)
    {
        if (el.ValueKind == JsonValueKind.Null || el.ValueKind == JsonValueKind.Undefined) return null;
        if (el.ValueKind == JsonValueKind.Number && el.TryGetInt32(out var i)) return i;
        var s = el.ToString()?.Trim();
        if (string.IsNullOrEmpty(s)) return null;
        return int.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, out var x) ? x : null;
    }

    private static double? TryDouble(JsonElement obj, string name)
    {
        if (!obj.TryGetProperty(name, out var el)) return null;
        return TryDoubleFromElement(el);
    }

    private static double? TryDoubleFromElement(JsonElement el)
    {
        if (el.ValueKind == JsonValueKind.Null || el.ValueKind == JsonValueKind.Undefined) return null;
        if (el.ValueKind == JsonValueKind.Number && el.TryGetDouble(out var d)) return d;
        var s = el.ToString()?.Trim();
        if (string.IsNullOrEmpty(s)) return null;
        return double.TryParse(s.Replace(',', '.'), NumberStyles.Float, CultureInfo.InvariantCulture, out var x)
            ? x : null;
    }
}
