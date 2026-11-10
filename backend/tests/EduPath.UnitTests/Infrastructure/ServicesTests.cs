using System.Text.RegularExpressions;
using EduPath.Api.Localization;
using EduPath.Application.Abstractions;
using EduPath.Application.Teaching;
using EduPath.Infrastructure.External;
using EduPath.Infrastructure.Security;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace EduPath.UnitTests.Infrastructure;

public class SandboxPaymentGatewayTests
{
    private readonly SandboxPaymentGateway gateway = new(
        Options.Create(new PaymentGatewayOptions { SimulatedLatencyMs = 0 }), NullLogger<SandboxPaymentGateway>.Instance);

    private Task<PaymentGatewayResult> Charge(string card) =>
        gateway.ChargeAsync(new PaymentRequest(690m, "UAH", card, "Софія Ткаченко", "Курс"));

    [Theory]
    [InlineData("4242 4242 4242 4242")]
    [InlineData("5555-5555-5555-4444")]
    public async Task Valid_card_is_charged(string card)
    {
        var result = await Charge(card);
        Assert.True(result.Succeeded);
        Assert.StartsWith("pi_", result.TransactionId);
        Assert.Equal(card[^4..], result.CardLast4);
    }

    [Theory]
    [InlineData("4000 0000 0000 0002", "банк відхилив картку")]
    [InlineData("4000 0000 0000 9995", "на картці недостатньо коштів")]
    [InlineData("4242 4242 4242 4241", "номер картки недійсний")]
    public async Task Test_cards_and_invalid_numbers_are_declined(string card, string reason)
    {
        var result = await Charge(card);
        Assert.False(result.Succeeded);
        Assert.Equal(reason, result.Error);
        Assert.Null(result.TransactionId);
    }

    [Theory]
    [InlineData("4242424242424242", true)]
    [InlineData("79927398713", false)]
    [InlineData("4111111111111111", true)]
    [InlineData("4111111111111112", false)]
    public void Luhn_check(string digits, bool expected) => Assert.Equal(expected, SandboxPaymentGateway.PassesLuhn(digits));
}

public class SecurityTests
{
    [Fact]
    public void Password_hash_is_salted_and_verifiable()
    {
        var hasher = new IdentityPasswordHasher();
        var first = hasher.Hash("Demo12345");
        var second = hasher.Hash("Demo12345");

        Assert.NotEqual(first, second);
        Assert.True(hasher.Verify(first, "Demo12345"));
        Assert.False(hasher.Verify(first, "demo12345"));
    }
}

public class WeeklySeriesTests
{
    [Fact]
    public void Groups_events_by_monday_and_fills_empty_weeks()
    {
        var now = new DateTime(2026, 11, 11, 12, 0, 0, DateTimeKind.Utc);
        var events = new (DateTime, decimal)[]
        {
            (new DateTime(2026, 11, 9, 8, 0, 0, DateTimeKind.Utc), 100m),
            (new DateTime(2026, 11, 8, 23, 0, 0, DateTimeKind.Utc), 50m),
            (new DateTime(2026, 11, 3, 9, 0, 0, DateTimeKind.Utc), 25m),
            (new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc), 999m),
        };

        var series = TeachingAnalyticsService.WeeklySeries(events, now, weeks: 3);

        Assert.Equal(
            [new DateTime(2026, 10, 26, 0, 0, 0, DateTimeKind.Utc), new DateTime(2026, 11, 2, 0, 0, 0, DateTimeKind.Utc), new DateTime(2026, 11, 9, 0, 0, 0, DateTimeKind.Utc)],
            series.Select(p => p.WeekStart));
        Assert.Equal([0m, 75m, 100m], series.Select(p => p.Value));
    }
}

public class MessageTranslatorTests
{
    [Fact]
    public void Translates_exact_messages() =>
        Assert.Equal("Course not found", MessageTranslator.ToEnglish("Курс не знайдено"));

    [Fact]
    public void Translates_templates_and_nested_fragments() =>
        Assert.Equal("Payment for “SQL для аналітиків” failed: insufficient funds on the card. Try another card.",
            MessageTranslator.ToEnglish("Оплата курсу «SQL для аналітиків» не пройшла: на картці недостатньо коштів. Спробуйте іншу картку."));

    [Fact]
    public void Keeps_user_content_untouched() =>
        Assert.Equal("Новий урок про канали вже доступний", MessageTranslator.ToEnglish("Новий урок про канали вже доступний"));

    [Fact]
    public void Catalog_covers_every_ukrainian_message_in_source_code()
    {
        var root = FindRepositoryRoot();
        var cyrillic = new Regex("[А-Яа-яІіЇїЄєҐґ]");
        var literal = new Regex("(?<interp>\\$?)\"(?<text>(?:[^\"\\\\\\n]|\\\\.)*)\"");
        var hole = new Regex(@"\{[^{}]+\}");
        var templates = EnglishCatalog.Templates.Keys.Select(k => Regex.Replace(k, @"\{\d+\}", "{}")).ToHashSet();
        var missing = new List<string>();
        var previous = "";

        foreach (var file in new[] { "EduPath.Domain", "EduPath.Application" }
                     .SelectMany(p => Directory.EnumerateFiles(Path.Combine(root, "src", p), "*.cs", SearchOption.AllDirectories))
                     .Where(f => !f.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}")))
        {
            foreach (var line in File.ReadLines(file))
            {
                var code = line.TrimStart();
                var skip = code.StartsWith("//") || code.Contains("Regex") || code.Contains(".Matches(")
                           || code.Contains("logger.Log")
                           || previous.Contains("GetDetails()");
                previous = code;
                if (skip) continue;
                foreach (Match m in literal.Matches(line))
                {
                    var text = m.Groups["text"].Value;
                    if (!cyrillic.IsMatch(text) || text.Contains("<!doctype") || text.Contains("<")) continue;
                    var known = m.Groups["interp"].Value == "$"
                        ? templates.Contains(hole.Replace(text, "{}")) || !text.Contains(' ')
                        : EnglishCatalog.Exact.ContainsKey(text);
                    if (!known) missing.Add($"{Path.GetFileName(file)}: {text}");
                }
            }
        }

        Assert.True(missing.Count == 0, "Немає перекладу для:\n" + string.Join('\n', missing.Distinct()));
    }

    private static string FindRepositoryRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "EduPath.sln"))) dir = dir.Parent;
        return dir?.FullName ?? throw new InvalidOperationException("Не знайдено EduPath.sln");
    }
}
