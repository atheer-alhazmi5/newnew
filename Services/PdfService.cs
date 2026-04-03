using System.Text;

namespace FormsSystem.Services;

public class PdfService
{
    public byte[] GenerateFormReport(string title, List<Dictionary<string, string>> rows, List<string> columns)
    {
        var sb = new StringBuilder();
        sb.AppendLine("<!DOCTYPE html><html lang='ar' dir='rtl'><head>");
        sb.AppendLine("<meta charset='UTF-8'>");
        sb.AppendLine("<style>");
        sb.AppendLine("@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;700&display=swap');");
        sb.AppendLine("body{font-family:'IBM Plex Sans Arabic',sans-serif;direction:rtl;padding:20px;color:#1a1a1a;}");
        sb.AppendLine("h1{color:#14573A;font-size:20px;margin-bottom:16px;}");
        sb.AppendLine("table{width:100%;border-collapse:collapse;font-size:13px;}");
        sb.AppendLine("th{background:#14573A;color:white;padding:8px 12px;text-align:right;}");
        sb.AppendLine("td{padding:7px 12px;border-bottom:1px solid #e5e7eb;text-align:right;}");
        sb.AppendLine("tr:nth-child(even){background:#f9fafb;}");
        sb.AppendLine(".header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;border-bottom:2px solid #14573A;padding-bottom:12px;}");
        sb.AppendLine(".date{font-size:12px;color:#6b7280;}");
        sb.AppendLine("@media print{body{padding:0;}@page{margin:1.5cm;}}");
        sb.AppendLine("</style></head><body>");

        sb.AppendLine($"<div class='header'><h1>{title}</h1><span class='date'>{DateTime.Now:yyyy/MM/dd HH:mm}</span></div>");
        sb.AppendLine("<table><thead><tr>");
        foreach (var col in columns)
            sb.AppendLine($"<th>{col}</th>");
        sb.AppendLine("</tr></thead><tbody>");

        foreach (var row in rows)
        {
            sb.AppendLine("<tr>");
            foreach (var col in columns)
                sb.AppendLine($"<td>{(row.TryGetValue(col, out var v) ? v : "")}</td>");
            sb.AppendLine("</tr>");
        }

        sb.AppendLine("</tbody></table></body></html>");
        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    public byte[] GenerateFormFillReport(string formName, string senderName, string recipientName,
        string sentDate, List<(string question, string answer)> qa)
    {
        var sb = new StringBuilder();
        sb.AppendLine("<!DOCTYPE html><html lang='ar' dir='rtl'><head><meta charset='UTF-8'>");
        sb.AppendLine("<style>");
        sb.AppendLine("@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;700&display=swap');");
        sb.AppendLine("body{font-family:'IBM Plex Sans Arabic',sans-serif;direction:rtl;padding:30px;color:#1a1a1a;max-width:800px;margin:0 auto;}");
        sb.AppendLine("h1{color:#14573A;font-size:22px;border-bottom:2px solid #14573A;padding-bottom:10px;}");
        sb.AppendLine(".meta{display:grid;grid-template-columns:1fr 1fr;gap:10px;background:#f9fafb;padding:15px;border-radius:8px;margin:15px 0;font-size:13px;}");
        sb.AppendLine(".qa{margin:12px 0;padding:12px;border:1px solid #e5e7eb;border-radius:6px;}");
        sb.AppendLine(".question{font-weight:700;color:#374151;font-size:13px;margin-bottom:6px;}");
        sb.AppendLine(".answer{color:#1a1a1a;background:#fff;padding:8px;border-radius:4px;font-size:13px;}");
        sb.AppendLine("@media print{@page{margin:1.5cm;}}");
        sb.AppendLine("</style></head><body>");
        sb.AppendLine($"<h1>{formName}</h1>");
        sb.AppendLine("<div class='meta'>");
        sb.AppendLine($"<div><b>المُرسِل:</b> {senderName}</div>");
        sb.AppendLine($"<div><b>المستلم:</b> {recipientName}</div>");
        sb.AppendLine($"<div><b>تاريخ الإرسال:</b> {sentDate}</div>");
        sb.AppendLine("</div>");
        foreach (var (q, a) in qa)
        {
            sb.AppendLine("<div class='qa'>");
            sb.AppendLine($"<div class='question'>{q}</div>");
            sb.AppendLine($"<div class='answer'>{a}</div>");
            sb.AppendLine("</div>");
        }
        sb.AppendLine("</body></html>");
        return Encoding.UTF8.GetBytes(sb.ToString());
    }
}
