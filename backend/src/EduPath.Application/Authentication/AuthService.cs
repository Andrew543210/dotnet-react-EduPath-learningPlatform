using EduPath.Application.Abstractions;
using EduPath.Application.Common;
using EduPath.Application.Notifications;
using EduPath.Domain.Notifications;
using EduPath.Domain.Settings;
using EduPath.Domain.Users;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace EduPath.Application.Authentication;

public sealed record RegisterRequest(string Name, string Email, string Password, UserRole? Role);

public sealed record LoginRequest(string Email, string Password);

public sealed record UpdateProfileRequest(string Name, string? Headline, string? Bio);

public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);

public sealed record UserDto(int Id, string Name, string Email, UserRole Role, string? Headline, string? Bio,
    bool IsBlocked, DateTime CreatedAt, DateTime? LastLoginAt)
{
    public static UserDto From(User u) => new(u.Id, u.Name, u.Email, u.Role, u.Headline, u.Bio, u.IsBlocked, u.CreatedAt, u.LastLoginAt);
}

public sealed record AuthResponse(string AccessToken, DateTime ExpiresAt, UserDto User);

public sealed class AuthService(
    IAppDbContext db,
    IPasswordHasher hasher,
    ITokenService tokens,
    ICurrentUser currentUser,
    NotificationService notifications,
    TimeProvider time)
{
    public async Task<AuthResponse> RegisterAsync(RegisterRequest request, CancellationToken ct)
    {
        var role = request.Role == UserRole.Teacher ? UserRole.Teacher : UserRole.Student;
        if (role == UserRole.Teacher)
        {
            var settings = await db.Settings.AsNoTracking().FirstOrDefaultAsync(ct) ?? new SystemSettings();
            if (!settings.AllowTeacherRegistration)
                throw new ForbiddenAccessException("Реєстрацію викладачів тимчасово закрито. Напишіть адміністратору платформи");
        }

        var email = User.NormalizeEmail(request.Email);
        if (await db.Users.AnyAsync(u => u.Email == email, ct))
            throw new ConflictException("Обліковий запис з цим email уже існує. Увійдіть або скористайтеся іншою адресою");

        var user = User.Register(request.Name, email, hasher.Hash(request.Password), role);
        user.RecordLogin(time.UtcNow());
        db.Users.Add(user);
        await db.SaveChangesAsync(ct);

        notifications.Notify(user.Id, NotificationType.General,
            role == UserRole.Teacher
                ? "Вітаємо на EduPath! Створіть перший курс у кабінеті викладача."
                : "Вітаємо на EduPath! Оберіть перший курс у каталозі.",
            role == UserRole.Teacher ? "/teach" : "/catalog", sendEmail: true);
        await db.SaveChangesAsync(ct);

        return Issue(user);
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken ct)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);
        if (user is null || !hasher.Verify(user.PasswordHash, request.Password))
            throw new AuthenticationFailedException("Неправильний email або пароль");
        if (!user.CanSignIn)
            throw new AuthenticationFailedException("Обліковий запис заблоковано. Зверніться до адміністратора");

        user.RecordLogin(time.UtcNow());
        await db.SaveChangesAsync(ct);
        return Issue(user);
    }

    public async Task<UserDto> GetMeAsync(CancellationToken ct) => UserDto.From(await LoadCurrentAsync(ct));

    public async Task<UserDto> UpdateProfileAsync(UpdateProfileRequest request, CancellationToken ct)
    {
        var user = await LoadCurrentAsync(ct);
        user.UpdateProfile(request.Name, request.Headline, request.Bio);
        await db.SaveChangesAsync(ct);
        return UserDto.From(user);
    }

    public async Task ChangePasswordAsync(ChangePasswordRequest request, CancellationToken ct)
    {
        var user = await LoadCurrentAsync(ct);
        if (!hasher.Verify(user.PasswordHash, request.CurrentPassword))
            throw new ForbiddenAccessException("Поточний пароль введено неправильно");
        user.ChangePassword(hasher.Hash(request.NewPassword));
        await db.SaveChangesAsync(ct);
    }

    private async Task<User> LoadCurrentAsync(CancellationToken ct)
    {
        var id = currentUser.RequireId();
        return await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct) ?? throw new NotFoundException("Користувача не знайдено");
    }

    private AuthResponse Issue(User user)
    {
        var token = tokens.Issue(user);
        return new AuthResponse(token.Token, token.ExpiresAt, UserDto.From(user));
    }
}

public sealed class RegisterRequestValidator : AbstractValidator<RegisterRequest>
{
    public RegisterRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Вкажіть ім'я").MaximumLength(User.NameMaxLength);
        RuleFor(x => x.Email).NotEmpty().WithMessage("Вкажіть email").EmailAddress().WithMessage("Email має бути у форматі name@example.com");
        RuleFor(x => x.Password).StrongPassword();
        RuleFor(x => x.Role).Must(r => r is null or UserRole.Student or UserRole.Teacher)
            .WithMessage("Можна зареєструватися лише як студент або викладач");
    }
}

public sealed class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().WithMessage("Вкажіть email");
        RuleFor(x => x.Password).NotEmpty().WithMessage("Вкажіть пароль");
    }
}

public sealed class UpdateProfileRequestValidator : AbstractValidator<UpdateProfileRequest>
{
    public UpdateProfileRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Вкажіть ім'я").MaximumLength(User.NameMaxLength);
        RuleFor(x => x.Headline).MaximumLength(120);
        RuleFor(x => x.Bio).MaximumLength(User.BioMaxLength);
    }
}

public sealed class ChangePasswordRequestValidator : AbstractValidator<ChangePasswordRequest>
{
    public ChangePasswordRequestValidator()
    {
        RuleFor(x => x.CurrentPassword).NotEmpty().WithMessage("Вкажіть поточний пароль");
        RuleFor(x => x.NewPassword).StrongPassword()
            .NotEqual(x => x.CurrentPassword).WithMessage("Новий пароль має відрізнятися від поточного");
    }
}

internal static class PasswordRules
{
    public static IRuleBuilderOptions<T, string> StrongPassword<T>(this IRuleBuilderInitial<T, string> rule) =>
        rule.Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Вкажіть пароль")
            .MinimumLength(8).WithMessage("Пароль має містити щонайменше 8 символів")
            .Matches("[0-9]").WithMessage("Додайте до пароля хоча б одну цифру")
            .Matches("[A-Za-zА-Яа-яІіЇїЄєҐґ]").WithMessage("Додайте до пароля хоча б одну літеру");
}
