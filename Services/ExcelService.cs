using System.Text;

namespace FormsSystem.Services;
//
/// <summary>
/// Excel-compatible CSV export (ClosedXML replacement without NuGet).
/// Returns UTF-8 BOM CSV bytes — opens correctly in Excel with RTL data.
/// </summary>
public class ExcelService
{
    public byte[] GenerateExcel(string sheetName, List<string> headers, List<List<string>> rows)
    {
        var sb = new StringBuilder();
        sb.AppendLine(string.Join(",", headers.Select(EscapeCsv)));
        foreach (var row in rows)
            sb.AppendLine(string.Join(",", row.Select(EscapeCsv)));

        // UTF-8 BOM so Excel opens Arabic correctly
        var bom = Encoding.UTF8.GetPreamble();
        var content = Encoding.UTF8.GetBytes(sb.ToString());
        var result = new byte[bom.Length + content.Length];
        bom.CopyTo(result, 0);
        content.CopyTo(result, bom.Length);
        return result;
    }

    private static string EscapeCsv(string value)
    {
        if (value.Contains(',') || value.Contains('"') || value.Contains('\n'))
            return $"\"{value.Replace("\"", "\"\"")}\"";
        return value;
    }
}
