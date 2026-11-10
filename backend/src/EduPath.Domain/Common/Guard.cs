namespace EduPath.Domain.Common;

internal static class Guard
{
    public static string NotEmpty(string? value, string message, int maxLength = int.MaxValue)
    {
        if (string.IsNullOrWhiteSpace(value)) throw new DomainException(message);
        var trimmed = value.Trim();
        if (trimmed.Length > maxLength) throw new DomainException($"{message} (не більше {maxLength} символів)");
        return trimmed;
    }

    public static int InRange(int value, int min, int max, string message) =>
        value < min || value > max ? throw new DomainException(message) : value;
}
