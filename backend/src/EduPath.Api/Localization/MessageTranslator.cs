using System.Globalization;
using System.Text.RegularExpressions;

namespace EduPath.Api.Localization;

public interface IMessageTranslator
{
    string Translate(string message);
}

public sealed class MessageTranslator : IMessageTranslator
{
    public static readonly string[] SupportedCultures = ["uk", "en"];

    private static readonly IReadOnlyList<(Regex Pattern, string Format)> Templates = EnglishCatalog.Templates
        .Select(t => (ToRegex(t.Key), t.Value))
        .ToList();

    public string Translate(string message) =>
        CultureInfo.CurrentUICulture.TwoLetterISOLanguageName == "en" ? ToEnglish(message, depth: 0) : message;

    public static string ToEnglish(string message, int depth = 0)
    {
        if (string.IsNullOrEmpty(message)) return message;
        if (EnglishCatalog.Exact.TryGetValue(message, out var exact)) return exact;
        if (depth > 2) return message;

        foreach (var (pattern, format) in Templates)
        {
            var match = pattern.Match(message);
            if (!match.Success) continue;
            var args = match.Groups.Cast<Group>().Skip(1).Select(g => (object)ToEnglish(g.Value, depth + 1)).ToArray();
            return string.Format(CultureInfo.InvariantCulture, format, args);
        }
        return message;
    }

    private static Regex ToRegex(string template)
    {
        var parts = Regex.Split(template, @"\{\d+\}");
        var pattern = "^" + string.Join("(.+?)", parts.Select(Regex.Escape)) + "$";
        return new Regex(pattern, RegexOptions.Compiled | RegexOptions.Singleline);
    }
}
