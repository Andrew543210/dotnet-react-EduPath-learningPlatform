using System.Security.Cryptography;
using EduPath.Application.Abstractions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EduPath.Infrastructure.External;

public sealed class PaymentGatewayOptions
{
    public const string Section = "Payments";

    public int SimulatedLatencyMs { get; set; } = 700;
}

public sealed class SandboxPaymentGateway(IOptions<PaymentGatewayOptions> options, ILogger<SandboxPaymentGateway> logger)
    : IPaymentGateway
{
    public static readonly IReadOnlyDictionary<string, string> DeclinedCards = new Dictionary<string, string>
    {
        ["4000000000000002"] = "банк відхилив картку",
        ["4000000000009995"] = "на картці недостатньо коштів",
        ["4000000000000069"] = "термін дії картки минув",
        ["4000000000000127"] = "неправильний CVC",
    };

    public async Task<PaymentGatewayResult> ChargeAsync(PaymentRequest request, CancellationToken cancellationToken = default)
    {
        if (options.Value.SimulatedLatencyMs > 0) await Task.Delay(options.Value.SimulatedLatencyMs, cancellationToken);

        var digits = string.Concat(request.CardNumber.Where(char.IsDigit));
        var last4 = digits.Length >= 4 ? digits[^4..] : null;

        if (!PassesLuhn(digits)) return Fail("номер картки недійсний", last4);
        if (DeclinedCards.TryGetValue(digits, out var reason)) return Fail(reason, last4);

        var transactionId = "pi_" + Convert.ToHexString(RandomNumberGenerator.GetBytes(12)).ToLowerInvariant();
        logger.LogInformation("Оплата {Amount} {Currency} пройшла: {TransactionId}", request.Amount, request.Currency, transactionId);
        return new PaymentGatewayResult(true, transactionId, null, last4);
    }

    private PaymentGatewayResult Fail(string reason, string? last4)
    {
        logger.LogInformation("Оплату відхилено: {Reason}", reason);
        return new PaymentGatewayResult(false, null, reason, last4);
    }

    public static bool PassesLuhn(string digits)
    {
        if (digits.Length is < 12 or > 19) return false;
        var sum = 0;
        var doubleIt = false;
        for (var i = digits.Length - 1; i >= 0; i--)
        {
            var d = digits[i] - '0';
            if (doubleIt && (d *= 2) > 9) d -= 9;
            sum += d;
            doubleIt = !doubleIt;
        }
        return sum % 10 == 0;
    }
}
