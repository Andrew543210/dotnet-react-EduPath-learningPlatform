using System.Reflection;

namespace EduPath.Infrastructure.Persistence.Seed;

internal static class SeedContent
{
    private const string Prefix = "seed/";

    private static readonly Assembly Assembly = typeof(SeedContent).Assembly;

    private static readonly Dictionary<string, string> Resources = Assembly.GetManifestResourceNames()
        .Where(name => name.StartsWith(Prefix, StringComparison.Ordinal))
        .ToDictionary(name => name[Prefix.Length..].Replace('\\', '/'), name => name);

    public static string Lesson(string courseKey, int number)
    {
        using var reader = new StreamReader(Open($"{courseKey}/{number:00}.md"));
        return reader.ReadToEnd().Trim();
    }

    public static Stream Open(string path) =>
        Resources.TryGetValue(path, out var name) && Assembly.GetManifestResourceStream(name) is { } stream
            ? stream
            : throw new InvalidOperationException($"Не знайдено вбудований файл демо-даних «{path}»");
}
