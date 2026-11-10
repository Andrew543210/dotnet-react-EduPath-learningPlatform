using EduPath.Application.Abstractions;
using EduPath.Application.Authentication;
using EduPath.Application.Common;
using EduPath.Application.Courses;
using EduPath.Application.Notifications;
using EduPath.Application.Teaching;
using EduPath.Domain.Courses;
using EduPath.Domain.Learning;
using EduPath.Domain.Notifications;
using EduPath.Domain.Payments;
using EduPath.Domain.Settings;
using EduPath.Domain.Users;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace EduPath.Application.Administration;

public sealed record AdminOverviewDto(
    int Students,
    int Teachers,
    int Admins,
    int PublishedCourses,
    int PendingCourses,
    int DraftCourses,
    int ActiveEnrollments,
    int CompletedEnrollments,
    int Certificates,
    decimal Revenue,
    int SuccessfulPayments,
    int FailedPayments,
    IReadOnlyList<WeeklyPointDto> RevenueByWeek,
    IReadOnlyList<WeeklyPointDto> SignupsByWeek);

public sealed record UserQuery(string? Search, UserRole? Role, int? Page = 1, int? PageSize = 20);

public sealed record AdminUserDto(int Id, string Name, string Email, UserRole Role, bool IsBlocked, DateTime CreatedAt,
    DateTime? LastLoginAt, int Enrollments, int Courses);

public sealed record ChangeRoleRequest(UserRole Role);

public sealed record BlockUserRequest(bool Blocked);

public sealed record ModerationRequest(string Comment);

public sealed record ModerationItemDto(CourseCardDto Course, string? ModerationComment, int TestCount);

public sealed record UpsertCategoryRequest(string Name, string Slug, string? Description, TrailColor Trail);

public sealed record SettingsDto(string PlatformName, string SupportEmail, int DefaultPassingScore, bool AllowTeacherRegistration,
    bool RequireCourseModeration)
{
    public static SettingsDto From(SystemSettings s) =>
        new(s.PlatformName, s.SupportEmail, s.DefaultPassingScore, s.AllowTeacherRegistration, s.RequireCourseModeration);
}

public sealed class AdminService(
    IAppDbContext db,
    ICurrentUser currentUser,
    NotificationService notifications,
    TimeProvider time)
{
    public async Task<AdminOverviewDto> GetOverviewAsync(CancellationToken ct)
    {
        var roles = await db.Users.GroupBy(u => u.Role).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);
        var statuses = await db.Courses.GroupBy(c => c.Status).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);
        var enrollments = await db.Enrollments.GroupBy(e => e.Status).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);
        var payments = await db.Payments.Select(p => new { p.Status, p.Amount, p.PaymentDate }).ToListAsync(ct);
        var signups = await db.Users.Select(u => u.CreatedAt).ToListAsync(ct);
        var now = time.UtcNow();

        int Role(UserRole r) => roles.FirstOrDefault(x => x.Key == r)?.Count ?? 0;
        int Status(CourseStatus s) => statuses.FirstOrDefault(x => x.Key == s)?.Count ?? 0;
        int Enrolled(EnrollmentStatus s) => enrollments.FirstOrDefault(x => x.Key == s)?.Count ?? 0;
        var succeeded = payments.Where(p => p.Status == PaymentStatus.Succeeded).ToList();

        return new AdminOverviewDto(
            Role(UserRole.Student), Role(UserRole.Teacher), Role(UserRole.Admin),
            Status(CourseStatus.Published), Status(CourseStatus.PendingReview), Status(CourseStatus.Draft),
            Enrolled(EnrollmentStatus.Active), Enrolled(EnrollmentStatus.Completed),
            await db.Certificates.CountAsync(ct),
            succeeded.Sum(p => p.Amount), succeeded.Count, payments.Count(p => p.Status == PaymentStatus.Failed),
            TeachingAnalyticsService.WeeklySeries(succeeded.Select(p => (p.PaymentDate, p.Amount)), now),
            TeachingAnalyticsService.WeeklySeries(signups.Select(d => (d, 1m)), now));
    }

    public async Task<PagedResult<AdminUserDto>> GetUsersAsync(UserQuery query, CancellationToken ct)
    {
        var users = db.Users.AsNoTracking();
        if (query.Role is not null) users = users.Where(u => u.Role == query.Role);
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLower();
            users = users.Where(u => u.Name.ToLower().Contains(term) || u.Email.Contains(term));
        }
        return await users.OrderByDescending(u => u.CreatedAt)
            .Select(u => new AdminUserDto(u.Id, u.Name, u.Email, u.Role, u.IsBlocked, u.CreatedAt, u.LastLoginAt,
                db.Enrollments.Count(e => e.UserId == u.Id && e.Status != EnrollmentStatus.Pending),
                db.Courses.Count(c => c.TeacherId == u.Id)))
            .ToPagedAsync(query.Page, query.PageSize, ct, defaultSize: 20);
    }

    public async Task<UserDto> ChangeRoleAsync(int userId, UserRole role, CancellationToken ct)
    {
        var user = await LoadOtherUserAsync(userId, "Власну роль змінити не можна", ct);
        user.ChangeRole(role);
        notifications.Notify(user.Id, NotificationType.General, $"Адміністратор змінив вашу роль на «{RoleName(role)}». Увійдіть знову, щоб оновити меню.");
        await db.SaveChangesAsync(ct);
        return UserDto.From(user);
    }

    public async Task<UserDto> SetBlockedAsync(int userId, bool blocked, CancellationToken ct)
    {
        var user = await LoadOtherUserAsync(userId, "Не можна заблокувати власний обліковий запис", ct);
        if (blocked) user.Block(); else user.Unblock();
        await db.SaveChangesAsync(ct);
        return UserDto.From(user);
    }

    public async Task<IReadOnlyList<ModerationItemDto>> GetModerationQueueAsync(CourseStatus? status, CancellationToken ct)
    {
        var filter = status ?? CourseStatus.PendingReview;
        var cards = await db.Courses.AsNoTracking().Where(c => c.Status == filter).OrderBy(c => c.UpdatedAt).ToCards(db)
            .ToListAsync(ct);
        var ids = cards.Select(c => c.Id).ToList();
        var extra = await db.Courses.Where(c => ids.Contains(c.Id))
            .Select(c => new { c.Id, c.ModerationComment, Tests = c.Lessons.Sum(l => l.Tests.Count) })
            .ToDictionaryAsync(c => c.Id, ct);
        return cards.Select(c => new ModerationItemDto(c, extra[c.Id].ModerationComment, extra[c.Id].Tests)).ToList();
    }

    public async Task ApproveAsync(int courseId, CancellationToken ct)
    {
        var course = await db.Courses.FirstOrDefaultAsync(c => c.Id == courseId, ct) ?? throw new NotFoundException("Курс не знайдено");
        course.Approve(time.UtcNow());
        notifications.Notify(course.TeacherId, NotificationType.Moderation,
            $"Курс «{course.Title}» опубліковано: студенти вже бачать його в каталозі.", $"/courses/{course.Id}", sendEmail: true);
        await db.SaveChangesAsync(ct);
    }

    public async Task RejectAsync(int courseId, string comment, CancellationToken ct)
    {
        var course = await db.Courses.FirstOrDefaultAsync(c => c.Id == courseId, ct) ?? throw new NotFoundException("Курс не знайдено");
        course.Reject(comment);
        notifications.Notify(course.TeacherId, NotificationType.Moderation,
            $"Курс «{course.Title}» повернуто на доопрацювання: {comment.Trim()}", $"/teach/courses/{course.Id}", sendEmail: true);
        await db.SaveChangesAsync(ct);
    }

    public async Task<CategoryDto> UpsertCategoryAsync(int? id, UpsertCategoryRequest request, CancellationToken ct)
    {
        var slug = request.Slug.Trim().ToLowerInvariant();
        if (await db.Categories.AnyAsync(c => c.Slug == slug && c.Id != id, ct))
            throw new ConflictException("Категорія з таким slug уже існує");

        Category category;
        if (id is null)
        {
            category = Category.Create(request.Name, slug, request.Description, request.Trail);
            db.Categories.Add(category);
        }
        else
        {
            category = await db.Categories.FirstOrDefaultAsync(c => c.Id == id, ct) ?? throw new NotFoundException("Категорію не знайдено");
            category.Update(request.Name, slug, request.Description, request.Trail);
        }
        await db.SaveChangesAsync(ct);
        var count = await db.Courses.CountAsync(c => c.CategoryId == category.Id && c.Status == CourseStatus.Published, ct);
        return new CategoryDto(category.Id, category.Name, category.Slug, category.Description, category.Trail, count);
    }

    public async Task DeleteCategoryAsync(int id, CancellationToken ct)
    {
        var category = await db.Categories.FirstOrDefaultAsync(c => c.Id == id, ct) ?? throw new NotFoundException("Категорію не знайдено");
        if (await db.Courses.AnyAsync(c => c.CategoryId == id, ct))
            throw new ConflictException("У категорії є курси. Перенесіть їх в іншу категорію перед видаленням");
        db.Categories.Remove(category);
        await db.SaveChangesAsync(ct);
    }

    public async Task<SettingsDto> GetSettingsAsync(CancellationToken ct) =>
        SettingsDto.From(await db.Settings.AsNoTracking().FirstOrDefaultAsync(ct) ?? new SystemSettings());

    public async Task<SettingsDto> UpdateSettingsAsync(SettingsDto request, CancellationToken ct)
    {
        var settings = await db.Settings.FirstOrDefaultAsync(ct);
        if (settings is null)
        {
            settings = new SystemSettings();
            db.Settings.Add(settings);
        }
        settings.Update(request.PlatformName, request.SupportEmail, request.DefaultPassingScore, request.AllowTeacherRegistration,
            request.RequireCourseModeration);
        await db.SaveChangesAsync(ct);
        return SettingsDto.From(settings);
    }

    private async Task<User> LoadOtherUserAsync(int userId, string selfMessage, CancellationToken ct)
    {
        if (userId == currentUser.RequireId()) throw new ForbiddenAccessException(selfMessage);
        return await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct) ?? throw new NotFoundException("Користувача не знайдено");
    }

    private static string RoleName(UserRole role) => role switch
    {
        UserRole.Teacher => "викладач",
        UserRole.Admin => "адміністратор",
        _ => "студент",
    };
}

public sealed class ModerationRequestValidator : AbstractValidator<ModerationRequest>
{
    public ModerationRequestValidator() =>
        RuleFor(x => x.Comment).NotEmpty().WithMessage("Поясніть викладачу, що потрібно виправити").MaximumLength(1000);
}

public sealed class UpsertCategoryRequestValidator : AbstractValidator<UpsertCategoryRequest>
{
    public UpsertCategoryRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Вкажіть назву категорії").MaximumLength(80);
        RuleFor(x => x.Slug).NotEmpty().Matches("^[a-z0-9-]+$").WithMessage("Slug — латиниця в нижньому регістрі, цифри та дефіс");
        RuleFor(x => x.Description).MaximumLength(300);
    }
}

public sealed class SettingsDtoValidator : AbstractValidator<SettingsDto>
{
    public SettingsDtoValidator()
    {
        RuleFor(x => x.PlatformName).NotEmpty().WithMessage("Вкажіть назву платформи").MaximumLength(60);
        RuleFor(x => x.SupportEmail).NotEmpty().EmailAddress().WithMessage("Вкажіть коректний email підтримки");
        RuleFor(x => x.DefaultPassingScore).InclusiveBetween(1, 100).WithMessage("Поріг — від 1 до 100 %");
    }
}

public sealed class SendNotificationRequestValidator : AbstractValidator<SendNotificationRequest>
{
    public SendNotificationRequestValidator() =>
        RuleFor(x => x.Message).NotEmpty().WithMessage("Напишіть текст сповіщення").MaximumLength(500);
}
