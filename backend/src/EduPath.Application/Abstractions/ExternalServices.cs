using EduPath.Application.Notifications;

namespace EduPath.Application.Abstractions;

public sealed record PaymentRequest(decimal Amount, string Currency, string CardNumber, string CardHolder, string Description);

public sealed record PaymentGatewayResult(bool Succeeded, string? TransactionId, string? Error, string? CardLast4);

public interface IPaymentGateway
{
    Task<PaymentGatewayResult> ChargeAsync(PaymentRequest request, CancellationToken cancellationToken = default);
}

public interface IFileStorage
{
    Task<string> SaveAsync(string folder, string fileName, Stream content, CancellationToken cancellationToken = default);

    Task DeleteAsync(string url, CancellationToken cancellationToken = default);
}

public interface IEmailSender
{
    Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken = default);
}

public interface IRealtimeNotifier
{
    Task PushAsync(int userId, NotificationDto notification, CancellationToken cancellationToken = default);
}
