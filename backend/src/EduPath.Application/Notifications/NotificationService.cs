using EduPath.Application.Abstractions;
using EduPath.Application.Common;
using EduPath.Domain.Courses;
using EduPath.Domain.Learning;
using EduPath.Domain.Notifications;
using EduPath.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace EduPath.Application.Notifications;

public sealed record NotificationDto(int Id, NotificationType Type, string Message, string? Link, bool IsRead, DateTime CreatedAt);

public sealed record NotificationPageDto(PagedResult<NotificationDto> Page, int UnreadCount);

public sealed record SendNotificationRequest(string Message, UserRole? Role);

public sealed class NotificationService(IAppDbContext db, ICurrentUser currentUser, TimeProvider time)
{
    public Notification Notify(int userId, NotificationType type, string message, string? link = null, bool sendEmail = false)
    {
        var notification = Notification.Create(userId, type, message, link, time.UtcNow(), sendEmail);
        db.Notifications.Add(notification);
        return notification;
    }

    public async Task<NotificationPageDto> GetMineAsync(int? page, int? pageSize, bool unreadOnly, CancellationToken ct)
    {
        var userId = currentUser.RequireId();
        var query = db.Notifications.Where(n => n.UserId == userId);
        if (unreadOnly) query = query.Where(n => !n.IsRead);

        var result = await query
            .OrderByDescending(n => n.CreatedAt).ThenByDescending(n => n.Id)
            .Select(n => new NotificationDto(n.Id, n.Type, n.Message, n.Link, n.IsRead, n.CreatedAt))
            .ToPagedAsync(page, pageSize, ct, defaultSize: 20);
        return new NotificationPageDto(result, await CountUnreadAsync(ct));
    }

    public Task<int> CountUnreadAsync(CancellationToken ct)
    {
        var userId = currentUser.RequireId();
        return db.Notifications.CountAsync(n => n.UserId == userId && !n.IsRead, ct);
    }

    public async Task<NotificationDto> OpenAsync(int notificationId, CancellationToken ct)
    {
        var userId = currentUser.RequireId();
        var n = await db.Notifications.FirstOrDefaultAsync(x => x.Id == notificationId && x.UserId == userId, ct)
                ?? throw new NotFoundException("Сповіщення не знайдено");
        n.Open();
        await db.SaveChangesAsync(ct);
        return new NotificationDto(n.Id, n.Type, n.Message, n.Link, n.IsRead, n.CreatedAt);
    }

    public async Task MarkAllAsReadAsync(CancellationToken ct)
    {
        var userId = currentUser.RequireId();
        var unread = await db.Notifications.Where(n => n.UserId == userId && !n.IsRead).ToListAsync(ct);
        unread.ForEach(n => n.MarkAsRead());
        await db.SaveChangesAsync(ct);
    }

    public async Task<int> SendToCourseStudentsAsync(int courseId, string message, CancellationToken ct)
    {
        var userId = currentUser.RequireId();
        var course = await db.Courses.AsNoTracking().FirstOrDefaultAsync(c => c.Id == courseId, ct)
                     ?? throw new NotFoundException("Курс не знайдено");
        if (course.TeacherId != userId && !currentUser.IsAdmin())
            throw new ForbiddenAccessException("Надсилати сповіщення може лише автор курсу");

        var studentIds = await db.Enrollments
            .Where(e => e.CourseId == courseId && e.Status != EnrollmentStatus.Pending)
            .Select(e => e.UserId).ToListAsync(ct);
        foreach (var id in studentIds)
            Notify(id, NotificationType.Course, $"{course.Title}: {message.Trim()}", $"/courses/{courseId}", sendEmail: true);

        await db.SaveChangesAsync(ct);
        return studentIds.Count;
    }

    public async Task<int> BroadcastAsync(SendNotificationRequest request, CancellationToken ct)
    {
        var ids = await db.Users
            .Where(u => !u.IsBlocked && (request.Role == null || u.Role == request.Role))
            .Select(u => u.Id).ToListAsync(ct);
        foreach (var id in ids) Notify(id, NotificationType.Announcement, request.Message.Trim());
        await db.SaveChangesAsync(ct);
        return ids.Count;
    }
}

public sealed class NotificationCreatedHandler(
    IAppDbContext db,
    IRealtimeNotifier realtime,
    IEmailSender email,
    ILogger<NotificationCreatedHandler> logger) : IDomainEventHandler<NotificationCreatedEvent>
{
    public async Task HandleAsync(NotificationCreatedEvent domainEvent, CancellationToken ct)
    {
        var n = domainEvent.Notification;
        try
        {
            await realtime.PushAsync(n.UserId, new NotificationDto(n.Id, n.Type, n.Message, n.Link, n.IsRead, n.CreatedAt), ct);
            if (domainEvent.SendEmail)
            {
                var address = await db.Users.Where(u => u.Id == n.UserId).Select(u => u.Email).FirstOrDefaultAsync(ct);
                if (address is not null) await email.SendAsync(address, "EduPath", n.Message, ct);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Не вдалося доставити сповіщення {NotificationId}", n.Id);
        }
    }
}
