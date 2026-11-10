using EduPath.Domain.Common;

namespace EduPath.Domain.Users;

public enum UserRole
{
    Student,
    Teacher,
    Admin,
}

public class User : AuditableEntity
{
    public const int NameMaxLength = 100;
    public const int BioMaxLength = 600;

    private User() { }

    public string Name { get; private set; } = "";
    public string Email { get; private set; } = "";
    public string PasswordHash { get; private set; } = "";
    public UserRole Role { get; private set; }
    public string? Headline { get; private set; }
    public string? Bio { get; private set; }
    public bool IsBlocked { get; private set; }
    public DateTime? LastLoginAt { get; private set; }

    public static User Register(string name, string email, string passwordHash, UserRole role = UserRole.Student) => new()
    {
        Name = Guard.NotEmpty(name, "Вкажіть ім'я", NameMaxLength),
        Email = NormalizeEmail(email),
        PasswordHash = Guard.NotEmpty(passwordHash, "Пароль не задано"),
        Role = role,
    };

    public bool CanSignIn => !IsBlocked;

    public void RecordLogin(DateTime now)
    {
        if (IsBlocked) throw new DomainException("Обліковий запис заблоковано адміністратором");
        LastLoginAt = now;
    }

    public void UpdateProfile(string name, string? headline, string? bio)
    {
        Name = Guard.NotEmpty(name, "Вкажіть ім'я", NameMaxLength);
        Headline = string.IsNullOrWhiteSpace(headline) ? null : headline.Trim();
        Bio = string.IsNullOrWhiteSpace(bio) ? null : Guard.NotEmpty(bio, "Опис профілю", BioMaxLength);
    }

    public void ChangePassword(string passwordHash) => PasswordHash = Guard.NotEmpty(passwordHash, "Пароль не задано");

    public void ChangeRole(UserRole role) => Role = role;

    public void Block() => IsBlocked = true;

    public void Unblock() => IsBlocked = false;

    public static string NormalizeEmail(string email)
    {
        var normalized = Guard.NotEmpty(email, "Вкажіть email", 200).ToLowerInvariant();
        var at = normalized.IndexOf('@');
        if (at <= 0 || at != normalized.LastIndexOf('@') || at == normalized.Length - 1)
            throw new DomainException("Email має бути у форматі name@example.com");
        return normalized;
    }
}
