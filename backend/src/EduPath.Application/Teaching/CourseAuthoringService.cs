using EduPath.Application.Abstractions;
using EduPath.Application.Certificates;
using EduPath.Application.Common;
using EduPath.Application.Courses;
using EduPath.Application.Notifications;
using EduPath.Domain.Assessment;
using EduPath.Domain.Common;
using EduPath.Domain.Courses;
using EduPath.Domain.Learning;
using EduPath.Domain.Notifications;
using EduPath.Domain.Settings;
using EduPath.Domain.Users;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace EduPath.Application.Teaching;

public sealed record UpsertCourseRequest(int CategoryId, string Title, string Summary, string? Description, decimal Price,
    CourseLevel Level, List<string>? Outcomes);

public sealed record UpsertLessonRequest(string Title, string? Content, int DurationMinutes, string? VideoUrl);

public sealed record MoveLessonRequest(int Position);

public sealed record QuestionInput(string Text, List<string> Options, string CorrectAnswer, string? Explanation);

public sealed record UpsertTestRequest(string Title, int PassingScore, List<QuestionInput> Questions);

public sealed record EditorQuestionDto(int Id, string Text, IReadOnlyList<string> Options, string CorrectAnswer, string? Explanation);

public sealed record EditorTestDto(int Id, string Title, int PassingScore, bool HasResults, IReadOnlyList<EditorQuestionDto> Questions);

public sealed record EditorLessonDto(int Id, string Title, string Content, int OrderNumber, int DurationMinutes, string? VideoUrl,
    string? MaterialUrl, string? MaterialName, IReadOnlyList<EditorTestDto> Tests);

public sealed record CourseEditorDto(
    int Id,
    string Title,
    string Summary,
    string Description,
    decimal Price,
    CourseLevel Level,
    int CategoryId,
    IReadOnlyList<string> Outcomes,
    CourseStatus Status,
    string? ModerationComment,
    DateTime UpdatedAt,
    int StudentCount,
    IReadOnlyList<EditorLessonDto> Lessons);

public sealed class CourseAuthoringService(
    IAppDbContext db,
    ICurrentUser currentUser,
    IFileStorage storage,
    NotificationService notifications,
    CertificateService certificates,
    TimeProvider time)
{
    public const long MaxMaterialBytes = 20 * 1024 * 1024;

    public static readonly IReadOnlySet<string> MaterialExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf", ".txt", ".md", ".csv", ".json", ".sql", ".zip", ".docx", ".xlsx", ".pptx", ".png", ".jpg", ".jpeg", ".webp",
    };

    public async Task<IReadOnlyList<CourseCardDto>> GetMyCoursesAsync(CancellationToken ct)
    {
        var userId = currentUser.RequireId();
        return await db.Courses.AsNoTracking().Where(c => c.TeacherId == userId).OrderByDescending(c => c.UpdatedAt)
            .ToCards(db).ToListAsync(ct);
    }

    public async Task<CourseEditorDto> GetEditorAsync(int courseId, CancellationToken ct) =>
        await ToEditorAsync(await LoadOwnedCourseAsync(courseId, ct), ct);

    public async Task<CourseEditorDto> CreateCourseAsync(UpsertCourseRequest request, CancellationToken ct)
    {
        var userId = currentUser.RequireId();
        await EnsureCategoryExistsAsync(request.CategoryId, ct);
        var course = Course.Create(userId, request.CategoryId, request.Title, request.Summary, request.Description ?? "",
            request.Price, request.Level, request.Outcomes);
        db.Courses.Add(course);
        await db.SaveChangesAsync(ct);
        return await ToEditorAsync(course, ct);
    }

    public async Task<CourseEditorDto> UpdateCourseAsync(int courseId, UpsertCourseRequest request, CancellationToken ct)
    {
        var course = await LoadOwnedCourseAsync(courseId, ct);
        await EnsureCategoryExistsAsync(request.CategoryId, ct);
        course.UpdateDetails(request.CategoryId, request.Title, request.Summary, request.Description ?? "", request.Price,
            request.Level, request.Outcomes ?? []);
        await db.SaveChangesAsync(ct);
        return await ToEditorAsync(course, ct);
    }

    public async Task DeleteCourseAsync(int courseId, CancellationToken ct)
    {
        var course = await LoadOwnedCourseAsync(courseId, ct);
        var hasStudents = await db.Enrollments.AnyAsync(e => e.CourseId == courseId, ct)
                          || await db.Payments.AnyAsync(p => p.CourseId == courseId, ct);
        if (hasStudents) throw new ConflictException("На курсі вже є студенти або оплати. Архівуйте курс замість видалення");
        db.Courses.Remove(course);
        await db.SaveChangesAsync(ct);
    }

    public async Task<CourseEditorDto> ArchiveCourseAsync(int courseId, CancellationToken ct)
    {
        var course = await LoadOwnedCourseAsync(courseId, ct);
        course.Archive();
        await db.SaveChangesAsync(ct);
        return await ToEditorAsync(course, ct);
    }

    public async Task<CourseEditorDto> SubmitForReviewAsync(int courseId, CancellationToken ct)
    {
        var course = await LoadOwnedCourseAsync(courseId, ct);
        var settings = await db.Settings.AsNoTracking().FirstOrDefaultAsync(ct) ?? new SystemSettings();
        course.SubmitForReview(settings.RequireCourseModeration, time.UtcNow());

        if (course.Status == CourseStatus.PendingReview)
        {
            var admins = await db.Users.Where(u => u.Role == UserRole.Admin && !u.IsBlocked).Select(u => u.Id).ToListAsync(ct);
            foreach (var adminId in admins)
                notifications.Notify(adminId, NotificationType.Moderation, $"Новий курс на перевірці: «{course.Title}»", "/admin/moderation");
        }
        await db.SaveChangesAsync(ct);
        return await ToEditorAsync(course, ct);
    }

    public async Task<CourseEditorDto> AddLessonAsync(int courseId, UpsertLessonRequest request, CancellationToken ct)
    {
        var course = await LoadOwnedCourseAsync(courseId, ct);
        course.AddLesson(request.Title, request.Content ?? "", request.DurationMinutes, request.VideoUrl);
        await db.SaveChangesAsync(ct);
        await SyncEnrollmentsAsync(course, ct);
        return await ToEditorAsync(course, ct);
    }

    public async Task<CourseEditorDto> UpdateLessonAsync(int lessonId, UpsertLessonRequest request, CancellationToken ct)
    {
        var (course, lesson) = await LoadOwnedLessonAsync(lessonId, ct);
        lesson.Update(request.Title, request.Content ?? "", request.DurationMinutes, request.VideoUrl);
        await db.SaveChangesAsync(ct);
        return await ToEditorAsync(course, ct);
    }

    public async Task<CourseEditorDto> MoveLessonAsync(int lessonId, MoveLessonRequest request, CancellationToken ct)
    {
        var (course, lesson) = await LoadOwnedLessonAsync(lessonId, ct);
        course.MoveLesson(lesson, request.Position);
        await db.SaveChangesAsync(ct);
        return await ToEditorAsync(course, ct);
    }

    public async Task<CourseEditorDto> DeleteLessonAsync(int lessonId, CancellationToken ct)
    {
        var (course, lesson) = await LoadOwnedLessonAsync(lessonId, ct);
        var testIds = lesson.Tests.Select(t => t.Id).ToList();
        if (await db.TestResults.AnyAsync(r => testIds.Contains(r.TestId), ct))
            throw new ConflictException("Студенти вже складали тест цього уроку. Відредагуйте урок замість видалення");
        course.RemoveLesson(lesson);
        db.Lessons.Remove(lesson);
        await db.SaveChangesAsync(ct);
        await SyncEnrollmentsAsync(course, ct);
        return await ToEditorAsync(course, ct);
    }

    public async Task<CourseEditorDto> UploadMaterialAsync(int lessonId, string fileName, Stream content, long length, CancellationToken ct)
    {
        if (length <= 0) throw new DomainException("Файл порожній");
        if (length > MaxMaterialBytes) throw new DomainException("Файл більший за 20 МБ. Стисніть його або завантажте частинами");
        if (!MaterialExtensions.Contains(Path.GetExtension(fileName)))
            throw new DomainException("Цей тип файлу не підтримується. Завантажте PDF, документ Office, ZIP-архів, зображення або текстовий файл");

        var (course, lesson) = await LoadOwnedLessonAsync(lessonId, ct);
        var previous = lesson.MaterialUrl;
        lesson.AttachMaterial(await storage.SaveAsync($"courses/{course.Id}", fileName, content, ct), Path.GetFileName(fileName));
        await db.SaveChangesAsync(ct);
        if (previous is not null) await storage.DeleteAsync(previous, ct);
        return await ToEditorAsync(course, ct);
    }

    public async Task<CourseEditorDto> RemoveMaterialAsync(int lessonId, CancellationToken ct)
    {
        var (course, lesson) = await LoadOwnedLessonAsync(lessonId, ct);
        var previous = lesson.MaterialUrl;
        lesson.RemoveMaterial();
        await db.SaveChangesAsync(ct);
        if (previous is not null) await storage.DeleteAsync(previous, ct);
        return await ToEditorAsync(course, ct);
    }

    public async Task<CourseEditorDto> CreateTestAsync(int lessonId, UpsertTestRequest request, CancellationToken ct)
    {
        var (course, lesson) = await LoadOwnedLessonAsync(lessonId, ct);
        var test = lesson.AddTest(request.Title, request.PassingScore);
        test.ReplaceQuestions(ToQuestions(request));
        await db.SaveChangesAsync(ct);
        return await ToEditorAsync(course, ct);
    }

    public async Task<CourseEditorDto> UpdateTestAsync(int testId, UpsertTestRequest request, CancellationToken ct)
    {
        var (course, test) = await LoadOwnedTestAsync(testId, ct);
        test.Update(request.Title, request.PassingScore);

        if (await db.TestResults.AnyAsync(r => r.TestId == testId, ct))
        {
            var unchanged = request.Questions.Count == test.Questions.Count && test.Questions.OrderBy(q => q.OrderNumber)
                .Zip(request.Questions).All(p => p.First.Text == p.Second.Text.Trim()
                                                 && p.First.CorrectAnswer == p.Second.CorrectAnswer.Trim()
                                                 && p.First.Options.SequenceEqual(p.Second.Options.Select(o => o.Trim()).Where(o => o.Length > 0)));
            if (!unchanged)
                throw new ConflictException("Тест уже складали студенти: змінити можна назву й поріг. Для нових питань створіть окремий тест");
        }
        else
        {
            db.Questions.RemoveRange(test.Questions.ToList());
            test.ReplaceQuestions(ToQuestions(request));
        }

        await db.SaveChangesAsync(ct);
        return await ToEditorAsync(course, ct);
    }

    public async Task<CourseEditorDto> DeleteTestAsync(int testId, CancellationToken ct)
    {
        var (course, test) = await LoadOwnedTestAsync(testId, ct);
        if (await db.TestResults.AnyAsync(r => r.TestId == testId, ct))
            throw new ConflictException("Тест уже складали студенти, тому його не можна видалити");
        var lesson = course.Lessons.First(l => l.Id == test.LessonId);
        lesson.RemoveTest(test);
        db.Tests.Remove(test);
        await db.SaveChangesAsync(ct);
        return await ToEditorAsync(course, ct);
    }

    private static IEnumerable<(string, IReadOnlyList<string>, string, string?)> ToQuestions(UpsertTestRequest request) =>
        request.Questions.Select(q => (q.Text, (IReadOnlyList<string>)q.Options, q.CorrectAnswer, q.Explanation));

    private async Task EnsureCategoryExistsAsync(int categoryId, CancellationToken ct)
    {
        if (!await db.Categories.AnyAsync(c => c.Id == categoryId, ct)) throw new DomainException("Оберіть категорію зі списку");
    }

    private async Task SyncEnrollmentsAsync(Course course, CancellationToken ct)
    {
        var lessonIds = course.Lessons.Select(l => l.Id).ToList();
        var enrollments = await db.Enrollments.Include(e => e.CompletedLessons)
            .Where(e => e.CourseId == course.Id && e.Status == EnrollmentStatus.Active)
            .ToListAsync(ct);

        var now = time.UtcNow();
        var finished = enrollments.Where(e => e.SyncWithProgram(lessonIds, now)).ToList();
        await db.SaveChangesAsync(ct);

        foreach (var enrollment in finished)
            await certificates.GenerateAsync(enrollment.UserId, course, finalTestResultId: null, ct);
    }

    private async Task<Course> LoadOwnedCourseAsync(int courseId, CancellationToken ct)
    {
        var userId = currentUser.RequireId();
        var course = await db.Courses
                         .Include(c => c.Lessons).ThenInclude(l => l.Tests).ThenInclude(t => t.Questions)
                         .FirstOrDefaultAsync(c => c.Id == courseId, ct)
                     ?? throw new NotFoundException("Курс не знайдено");
        if (course.TeacherId != userId && !currentUser.IsAdmin()) throw new ForbiddenAccessException("Редагувати курс може лише його автор");
        return course;
    }

    private async Task<(Course, Lesson)> LoadOwnedLessonAsync(int lessonId, CancellationToken ct)
    {
        var courseId = await db.Lessons.Where(l => l.Id == lessonId).Select(l => (int?)l.CourseId).FirstOrDefaultAsync(ct)
                       ?? throw new NotFoundException("Урок не знайдено");
        var course = await LoadOwnedCourseAsync(courseId, ct);
        return (course, course.Lessons.First(l => l.Id == lessonId));
    }

    private async Task<(Course, Test)> LoadOwnedTestAsync(int testId, CancellationToken ct)
    {
        var courseId = await db.Tests.Where(t => t.Id == testId).Select(t => (int?)t.Lesson!.CourseId).FirstOrDefaultAsync(ct)
                       ?? throw new NotFoundException("Тест не знайдено");
        var course = await LoadOwnedCourseAsync(courseId, ct);
        return (course, course.Lessons.SelectMany(l => l.Tests).First(t => t.Id == testId));
    }

    private async Task<CourseEditorDto> ToEditorAsync(Course c, CancellationToken ct)
    {
        var testIds = c.Lessons.SelectMany(l => l.Tests).Select(t => t.Id).ToList();
        var testsWithResults = (await db.TestResults.Where(r => testIds.Contains(r.TestId)).Select(r => r.TestId).Distinct()
            .ToListAsync(ct)).ToHashSet();
        var students = await db.Enrollments.CountAsync(e => e.CourseId == c.Id && e.Status != EnrollmentStatus.Pending, ct);

        return new CourseEditorDto(c.Id, c.Title, c.Summary, c.Description, c.Price, c.Level, c.CategoryId, c.Outcomes, c.Status,
            c.ModerationComment, c.UpdatedAt, students,
            c.OrderedLessons().Select(l => new EditorLessonDto(l.Id, l.Title, l.Content, l.OrderNumber, l.DurationMinutes, l.VideoUrl,
                storage.GetDownloadUrl(l.MaterialUrl), l.MaterialName,
                l.Tests.OrderBy(t => t.Id).Select(t => new EditorTestDto(t.Id, t.Title, t.PassingScore, testsWithResults.Contains(t.Id),
                    t.Questions.OrderBy(q => q.OrderNumber)
                        .Select(q => new EditorQuestionDto(q.Id, q.Text, q.Options, q.CorrectAnswer, q.Explanation)).ToList())).ToList()))
            .ToList());
    }
}

public sealed class UpsertCourseRequestValidator : AbstractValidator<UpsertCourseRequest>
{
    public UpsertCourseRequestValidator()
    {
        RuleFor(x => x.Title).NotEmpty().WithMessage("Вкажіть назву курсу").MaximumLength(Course.TitleMaxLength);
        RuleFor(x => x.Summary).NotEmpty().WithMessage("Додайте короткий опис: одне-два речення про курс").MaximumLength(Course.SummaryMaxLength);
        RuleFor(x => x.Description).MaximumLength(20_000);
        RuleFor(x => x.Price).InclusiveBetween(0, Course.MaxPrice).WithMessage("Ціна — від 0 до 100 000 грн");
        RuleFor(x => x.CategoryId).GreaterThan(0).WithMessage("Оберіть категорію");
        RuleForEach(x => x.Outcomes).MaximumLength(200);
    }
}

public sealed class UpsertLessonRequestValidator : AbstractValidator<UpsertLessonRequest>
{
    public UpsertLessonRequestValidator()
    {
        RuleFor(x => x.Title).NotEmpty().WithMessage("Вкажіть назву уроку").MaximumLength(160);
        RuleFor(x => x.Content).MaximumLength(50_000);
        RuleFor(x => x.DurationMinutes).InclusiveBetween(1, 600).WithMessage("Тривалість — від 1 до 600 хвилин");
        RuleFor(x => x.VideoUrl).Must(u => string.IsNullOrWhiteSpace(u) || Uri.TryCreate(u, UriKind.Absolute, out var uri) && uri.Scheme is "https" or "http")
            .WithMessage("Посилання на відео має починатися з https://");
    }
}

public sealed class UpsertTestRequestValidator : AbstractValidator<UpsertTestRequest>
{
    public UpsertTestRequestValidator()
    {
        RuleFor(x => x.Title).NotEmpty().WithMessage("Вкажіть назву тесту").MaximumLength(160);
        RuleFor(x => x.PassingScore).InclusiveBetween(1, 100).WithMessage("Поріг — від 1 до 100 %");
        RuleFor(x => x.Questions).NotEmpty().WithMessage("Додайте хоча б одне питання");
        RuleForEach(x => x.Questions).ChildRules(q =>
        {
            q.RuleFor(x => x.Text).NotEmpty().WithMessage("Кожне питання має містити текст");
            q.RuleFor(x => x.Options).Must(o => o.Count(s => !string.IsNullOrWhiteSpace(s)) >= 2)
                .WithMessage("У кожному питанні потрібно щонайменше два варіанти");
            q.RuleFor(x => x.CorrectAnswer).NotEmpty().WithMessage("Позначте правильну відповідь у кожному питанні");
        });
    }
}
