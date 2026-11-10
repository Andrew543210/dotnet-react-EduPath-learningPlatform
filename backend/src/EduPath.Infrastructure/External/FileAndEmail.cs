using System.Text.RegularExpressions;
using EduPath.Application.Abstractions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EduPath.Infrastructure.External;

public sealed class StorageOptions
{
    public const string Section = "Storage";

    public string RootPath { get; set; } = "App_Data/files";

    public string PublicPath { get; set; } = "/files";
}

public sealed partial class LocalFileStorage(IOptions<StorageOptions> options) : IFileStorage
{
    private string Root => Path.GetFullPath(options.Value.RootPath);

    public async Task<string> SaveAsync(string folder, string fileName, Stream content, CancellationToken cancellationToken = default)
    {
        var safeFolder = string.Join('/', folder.Split('/', StringSplitOptions.RemoveEmptyEntries).Select(Sanitize));
        var name = $"{Guid.NewGuid().ToString("N")[..8]}-{Sanitize(Path.GetFileName(fileName))}";
        name = name[..Math.Min(name.Length, 120)];

        var directory = Path.Combine(Root, safeFolder);
        Directory.CreateDirectory(directory);
        await using (var file = File.Create(Path.Combine(directory, name)))
            await content.CopyToAsync(file, cancellationToken);

        return $"{options.Value.PublicPath.TrimEnd('/')}/{safeFolder}/{name}";
    }

    public Task DeleteAsync(string url, CancellationToken cancellationToken = default)
    {
        var prefix = options.Value.PublicPath.TrimEnd('/') + "/";
        if (!url.StartsWith(prefix, StringComparison.Ordinal)) return Task.CompletedTask;

        var path = Path.GetFullPath(Path.Combine(Root, url[prefix.Length..]));
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
