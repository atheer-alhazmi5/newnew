using System.Globalization;
using System.Net;

namespace FormsSystem.Services;

public class UiHelperService
{
    private static readonly UmAlQuraCalendar _hijri = new();
    private static readonly string[] _hijriMonths =
        ["محرم","صفر","ربيع الأول","ربيع الثاني","جمادى الأولى","جمادى الثانية",
         "رجب","شعبان","رمضان","شوال","ذو القعدة","ذو الحجة"];
    private static readonly string[] _arabicDays =
        ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];

    public string ConvertToHijri(DateTime date)
    {
        var day = _hijri.GetDayOfMonth(date);
        var month = _hijri.GetMonth(date);
        var year = _hijri.GetYear(date);
        var dayName = _arabicDays[(int)date.DayOfWeek];
        return $"{dayName}، {day} {_hijriMonths[month - 1]} {year}هـ";
    }

    public string GetCurrentHijriDate() => ConvertToHijri(DateTime.Now);
    public string GetCurrentTime() => DateTime.Now.ToString("hh:mm tt", new CultureInfo("ar-SA"));
    public string SanitizeInput(string input) => WebUtility.HtmlEncode(input);

    public string FormatDate(DateTime? dt) => dt.HasValue
        ? dt.Value.ToString("yyyy/MM/dd", CultureInfo.InvariantCulture) : "";

    public string GetFormStatus(string status) => status switch
    {
        "published" => "منشور",
        "pending_approval" => "قيد الاعتماد",
        "active" => "نشط",
        _ => status
    };
}
