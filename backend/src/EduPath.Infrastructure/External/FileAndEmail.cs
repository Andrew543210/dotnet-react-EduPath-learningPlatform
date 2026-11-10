using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using EduPath.Application.Abstractions;
using EduPath.Infrastructure.Security;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EduPath.Infrastructure.External;

public sealed class StorageOptions
{
    public const string Section = "Storage";

    public string RootPath { get; set; } = "App_Data/files";

    public string PublicPath { get; set; } = "/files";

    public TimeSpan DownloadLinkLifetime { get; set; } = TimeSpan.FromHours(6);
}

public sealed class FileUrlSigner(IOptions<StorageOptions> storage, IOptions<JwtOptions> jwt, TimeProvider time)
{
    private const int Granularity = 3600;

    private readonly byte[] key = HMACSHA256.HashData(Encoding.UTF8.GetBytes(jwt.Value.SigningKey), "edupath-file-downloads"u8);

    public string Sign(string url)
    {
        var expires = (time.GetUtcNow() + storage.Value.DownloadLinkLifetime).ToUnixTimeSeconds() / Granularity * Granularity + Granularity;
        return $"{url}?expires={expires}&signature={Signature(url, expires)}";
    }

    public bool Verify(string url, string? expires, string? signature)
    {
        if (signature is null || !long.TryParse(expires, NumberStyles.None, CultureInfo.InvariantCulture, out var seconds)) return false;
        if (time.GetUtcNow().ToUnixTimeSeconds() > seconds) return false;
        return CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(Signature(url, seconds)), Encoding.ASCII.GetBytes(signature));
    }

    private string Signature(string url, long expires) =>
        Convert.ToHexStringLower(HMACSHA256.HashData(key, Encoding.UTF8.GetBytes($"{url}|{expires}")));
}

public sealed partial class LocalFileStorage(IOptions<StorageOptions> options, FileUrlSigner signer) : IFileStorage
{
    private string Root => Path.GetFullPath(options.Value.RootPath);

    private string Prefix => options.Value.PublicPath.TrimEnd('/') + "/";

    public async Task<string> SaveAsync(string folder, string fileName, Stream content, CancellationToken cancellationToken = default)
    {
        var safeFolder = string.Join('/', folder.Split('/', StringSplitOptions.RemoveEmptyEntries).Select(Sanitize));
        var name = $"{Guid.NewGuid().ToString("N")[..8]}-{Sanitize(Path.GetFileName(fileName))}";
        name = name[..Math.Min(name.Length, 120)];

        var directory = Path.Combine(Root, safeFolder);
        Directory.CreateDirectory(directory);
        await using (var file = File.Create(Path.Combine(directory, name)))
            await content.CopyToAsync(file, cancellationToken);

        return $"{Prefix}{safeFolder}/{name}";
    }

    public string? GetDownloadUrl(string? url) =>
        url is not null && url.StartsWith(Prefix, StringComparison.Ordinal) ? signer.Sign(url) : url;

    public Task DeleteAsync(string url, CancellationToken cancellationToken = default)
    {
        if (!url.StartsWith(Prefix, StringComparison.Ordinal)) return Task.CompletedTask;

        var path = Path.GetFullPath(Path.Combine(Root, url[Prefix.Length..]));
        if (path.StartsWith(Root, StringComparison.OrdinalIgnoreCase) && File.Exists(path)) File.Delete(path);
        return Task.CompletedTask;
    }

    private static string Sanitize(string value)
    {
        var cleaned = UnsafeChars().Replace(value, "-").Trim('-', '.');
        return cleaned.Length == 0 ? "file" : cleaned;
    }

    [GeneratedRegex(@"[^\p{L}\p{Nd}._-]+")]
    private static partial Regex UnsafeChars();
}

public sealed class LoggingEmailSender(ILogger<LoggingEmailSender> logger) : IEmailSender
{
    public Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken = default)
    {
        logger.LogInformation("Лист для {To}: {Subject} — {Body}", to, subject, body);
        return Task.CompletedTask;
    }
}
