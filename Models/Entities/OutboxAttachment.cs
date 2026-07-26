namespace FormsSystem.Models.Entities;

/// <summary>
/// وثيقة مرفقة بطلب في صندوق الصادر. المصدر إمّا حقل «رفع ملف» داخل النموذج
/// أو مرفق أُضيف مع تعليق. الملف نفسه يُخزَّن في wwwroot/uploads/outbox.
/// </summary>
public class OutboxAttachment
{
    public int Id { get; set; }
    public int OutboxRequestId { get; set; }

    /// <summary>نوع المرفق: «مرفق نموذج» أو «مرفق تعليق».</summary>
    public string Source { get; set; } = OutboxAttachmentSources.Form;

    /// <summary>معرّف التعليق عندما يكون المرفق تابعاً لتعليق.</summary>
    public int? OutboxCommentId { get; set; }

    /// <summary>اسم حقل النموذج عندما يكون المرفق قادماً من حقل «رفع ملف».</summary>
    public string FieldName { get; set; } = "";

    public string FileName { get; set; } = "";
    public string Url { get; set; } = "";
    public string ContentType { get; set; } = "";
    public long Size { get; set; }

    public int UploadedById { get; set; }
    public string UploadedByName { get; set; } = "";
    public DateTime UploadedAt { get; set; } = DateTime.Now;
}

/// <summary>القيم المعتمدة لحقل <see cref="OutboxAttachment.Source"/>.</summary>
public static class OutboxAttachmentSources
{
    public const string Form = "مرفق نموذج";
    public const string Comment = "مرفق تعليق";
}
