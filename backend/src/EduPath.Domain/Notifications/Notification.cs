using EduPath.Domain.Common;

namespace EduPath.Domain.Notifications;

public enum NotificationType
{
    General,
    Course,
    Payment,
    Test,
    Certificate,
    Moderation,
    Announcement,
}

public class Notification : Entity
{
    private Notification() { }

    public int UserId { get; private set; }
    public NotificationType Type { get; private set; }
    public string Message { get; private set; } = "";
    public string? Link { get; private set; }
    public bool IsRead { get; private set; }
    public DateTime CreatedAt { get; private set; }

    public static Notification Create(int userId, NotificationType type, string message, string? link, DateTime now, bool sendEmail = false)
    {
        var notification = new Notification
        {
            UserId = userId,
            Type = type,
            Message = Guard.NotEmpty(message, "Текст сповіщення порожній", 1000),
            Link = link,
            CreatedAt = now,
        };
        notification.Raise(new NotificationCreatedEvent(notification, sendEmail));
        return notification;
    }

    public void MarkAsRead() => IsRead = true;

    public string? Open()
    {
        MarkAsRead();
        return Link;
    }
}

public sealed record NotificationCreatedEvent(Notification Notification, bool SendEmail) : IDomainEvent;
