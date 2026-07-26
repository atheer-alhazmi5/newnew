namespace FormsSystem.Models.Entities;

/// <summary>
/// تعليق على طلب في صندوق الصادر — يظهر في تبويب «التعليقات» بصفحة تفاصيل الطلب.
/// المرفقات المرتبطة بالتعليق تُحفظ ككيانات <see cref="OutboxAttachment"/> مستقلة
/// حتى تظهر أيضاً ضمن تبويب «الوثائق المرفقة».
/// </summary>
public class OutboxComment
{
    public int Id { get; set; }
    public int OutboxRequestId { get; set; }

    /// <summary>نوع التعليق: «عام» أو «طلب توضيح».</summary>
    public string CommentType { get; set; } = "عام";

    public string Content { get; set; } = "";

    public int AuthorId { get; set; }
    public string AuthorName { get; set; } = "";
    public string AuthorDept { get; set; } = "";

    public DateTime CreatedAt { get; set; } = DateTime.Now;
}
