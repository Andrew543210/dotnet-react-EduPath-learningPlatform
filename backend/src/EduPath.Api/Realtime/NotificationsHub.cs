using EduPath.Application.Abstractions;
using EduPath.Application.Notifications;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace EduPath.Api.Realtime;

[Authorize]
public sealed class NotificationsHub : Hub
{
    public const string Path = "/hubs/notifications";
    public const string NotificationEvent = "notification";
}

public sealed class SignalRNotifier(IHubContext<NotificationsHub> hub) : IRealtimeNotifier
{
    public Task PushAsync(int userId, NotificationDto notification, CancellationToken cancellationToken = default) =>
        hub.Clients.User(userId.ToString()).SendAsync(NotificationsHub.NotificationEvent, notification, cancellationToken);
}
