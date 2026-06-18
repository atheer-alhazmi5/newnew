namespace FormsSystem.Models.Entities;

/// <summary>سجل اطلاع مستخدم على إشعار منبثق.</summary>
public class PopupViewEntry
{
    public int UserId { get; set; }
    public DateTime ViewedAt { get; set; } = DateTime.Now;
}
