using EduPath.Application.Abstractions;
using EduPath.Application.Certificates;
using EduPath.Application.Common;
using EduPath.Application.Notifications;
using EduPath.Domain.Common;
using EduPath.Domain.Courses;
using EduPath.Domain.Learning;
using EduPath.Domain.Notifications;
using EduPath.Domain.Users;
using Microsoft.EntityFrameworkCore;

namespace EduPath.Application.Learning;

public sealed record EnrollmentDto(int Id, int CourseId, EnrollmentStatus Status, int Progress, DateTime EnrolledAt);

public sealed record RouteStopDto(int Id, string Title, bool HasTest, bool IsCompleted);

public sealed record MyCourseDto(
    int CourseId,
    string Title,
    TrailColor Trail,
    string CategoryName,
    string TeacherName,
    int Progress,
    EnrollmentStatus Status,
    int? NextLessonId,
    string? NextLessonTitle,
    int? CertificateId,
    DateTime EnrolledAt,
    DateTime? LastActivityAt,
    IReadOnlyList<RouteStopDto> Route);

public sealed record LessonTestDto(int Id, string Title, int PassingScore, int QuestionCount, int Attempts, int? BestScore, bool Passed);

public sealed record LessonDto(
    int Id,
    int CourseId,
    string CourseTitle,
    TrailColor Trail,
    string Title,
    string Content,
    int OrderNumber,
    int DurationMinutes,
    string? VideoUrl,
    string? MaterialUrl,
    string? MaterialName,
    IReadOnlyList<LessonTestDto> Tests,
    bool IsCompleted,
    int? PrevLessonId,
    int? NextLessonId,
    int CourseProgress,
    IReadOnlyList<RouteStopDto> Route,
    bool IsPreview);

public sealed record LessonProgressDto(int CourseProgress, bool CourseCompleted, int? NextLessonId, int? CertificateId, LearningState NextState);

public sealed class LearningService(
    IAppDbContext db,
    ICurrentUser currentUser,
    NotificationService notifications,
    CertificateService certificates,
    TimeProvider time)
{
    public async Task<EnrollmentDto> EnrollFreeAsync(int courseId, CancellationToken ct)
    {
        var userId = RequireStudent();
        var course = await LoadCourseAsync(courseId, ct);
        if (!course.IsAvailable()) throw new NotFoundException("Курс не знайдено або ще не опублікований");
        if (!course.IsFree) throw new DomainException("Цей курс платний: оформіть оплату, щоб отримати доступ");

        LearningStateMachine.Fire(LearningState.CourseNotPurchased, LearningTrigger.EnrollFree);
        var enrollment = await EnrollStudentAsync(userId, course, ct);
        await db.SaveChangesAsync(ct);
        return ToDto(enrollment);
    }

    public async Task<Enrollment> EnrollStudentAsync(int userId, Course course, CancellationToken ct)
    {
        var now = time.UtcNow();
        var enrollment = await db.Enrollments.FirstOrDefaultAsync(e => e.UserId == userId && e.CourseId == course.Id, ct);
        if (enrollment is null)
        {
            enrollment = Enrollment.Create(userId, course.Id, now);
            db.Enrollments.Add(enrollment);
        }
        enrollment.Activate(now);

        var firstLesson = course.OrderedLessons().FirstOrDefault();
        notifications.Notify(userId, NotificationType.Course,
            $"Доступ до курсу «{course.Title}» відкрито. Перший урок уже чекає.",
            firstLesson is null ? $"/courses/{course.Id}" : $"/learn/lessons/{firstLesson.Id}");

        var teacherMessage = $"Новий студент на курсі «{course.Title}»";
        notifications.Notify(course.TeacherId, NotificationType.Course, teacherMessage, $"/teach/courses/{course.Id}/students");
        return enrollment;
    }

    public async Task<IReadOnlyList<MyCourseDto>> GetMyCoursesAsync(CancellationToken ct)
    {
        var userId = currentUser.RequireId();
        var enrollments = await db.Enrollments.AsNoTracking()
            .Where(e => e.UserId == userId && e.Status != EnrollmentStatus.Pending)
            .Include(e => e.CompletedLessons)
            .Include(e => e.Course!).ThenInclude(c => c.Lessons).ThenInclude(l => l.Tests)
            .Include(e => e.Course!).ThenInclude(c => c.Category)
            .Include(e => e.Course!).ThenInclude(c => c.Teacher)
            .ToListAsync(ct);
        var certificateIds = await db.Certificates.Where(c => c.UserId == userId)
            .ToDictionaryAsync(c => c.CourseId, c => (int?)c.Id, ct);

        return enrollments
            .OrderBy(e => e.Status == EnrollmentStatus.Completed)
            .ThenByDescending(e => e.LastActivityAt ?? e.EnrolledAt)
            .Select(e =>
            {
                var c = e.Course!;
                var next = c.OrderedLessons().FirstOrDefault(l => !e.IsLessonCompleted(l.Id));
                return new MyCourseDto(c.Id, c.Title, c.Category!.Trail, c.Category.Name, c.Teacher!.Name, e.Progress, e.Status,
                    next?.Id, next?.Title, certificateIds.GetValueOrDefault(c.Id), e.EnrolledAt, e.LastActivityAt, Route(c, e));
            })
            .ToList();
    }

    public async Task<LessonDto> GetLessonAsync(int lessonId, CancellationToken ct)
    {
        var userId = currentUser.RequireId();
        var lesson = await LoadLessonAsync(lessonId, ct);
        var course = lesson.Course!;
        var enrollment = await GetEnrollmentAsync(userId, course.Id, ct);

        var isPreview = course.TeacherId == userId || currentUser.IsAdmin();
        if (!isPreview) lesson.Open(enrollment);

        var testIds = lesson.Tests.Select(t => t.Id).ToList();
        var results = await db.TestResults.AsNoTracking()
            .Where(r => r.UserId == userId && testIds.Contains(r.TestId))
            .Select(r => new { r.TestId, r.Score, r.Passed })
            .ToListAsync(ct);

        var ordered = course.OrderedLessons().ToList();
        var index = ordered.FindIndex(l => l.Id == lesson.Id);
        var tests = lesson.Tests.OrderBy(t => t.Id).Select(t =>
        {
            var mine = results.Where(r => r.TestId == t.Id).ToList();
            return new LessonTestDto(t.Id, t.Title, t.PassingScore, t.Questions.Count, mine.Count,
                mine.Count == 0 ? null : mine.Max(r => r.Score), mine.Any(r => r.Passed));
        }).ToList();

        return new LessonDto(
            lesson.Id, course.Id, course.Title, course.Category!.Trail, lesson.Title, lesson.Content, lesson.OrderNumber,
            lesson.DurationMinutes, lesson.VideoUrl, lesson.MaterialUrl, lesson.MaterialName, tests,
            enrollment?.IsLessonCompleted(lesson.Id) ?? false,
            index > 0 ? ordered[index - 1].Id : null,
            index < ordered.Count - 1 ? ordered[index + 1].Id : null,
            enrollment?.Progress ?? 0,
            Route(course, enrollment),
            isPreview);
    }

    public async Task<LessonProgressDto> CompleteLessonAsync(int lessonId, CancellationToken ct)
    {
        var userId = RequireStudent();
        var lesson = await LoadLessonAsync(lessonId, ct, tracking: true);
        if (lesson.Tests.Count > 0)
            throw new DomainException("Урок зарахується після тесту: потрібно набрати не менше порогового балу");

        var enrollment = await GetEnrollmentAsync(userId, lesson.CourseId, ct, tracking: true);
        lesson.Open(enrollment);

        var state = LearningStateMachine.Fire(LearningState.ViewingLesson, LearningTrigger.MarkLessonCompleted);
        var result = await AdvanceAsync(enrollment!, lesson, state, finalTestResultId: null, ct);
        await db.SaveChangesAsync(ct);
        return result;
    }

    public async Task<LessonProgressDto> AdvanceAsync(Enrollment enrollment, Lesson lesson, LearningState state,
        int? finalTestResultId, CancellationToken ct)
    {
        var course = lesson.Course!;
        var now = time.UtcNow();
        lesson.MarkCompleted(enrollment, now);
        enrollment.RecalculateProgress(course.Lessons.Select(l => l.Id).ToList(), now);

        var ordered = course.OrderedLessons().ToList();
        var next = ordered.SkipWhile(l => l.Id != lesson.Id).Skip(1).FirstOrDefault(l => !enrollment.IsLessonCompleted(l.Id))
                   ?? ordered.FirstOrDefault(l => !enrollment.IsLessonCompleted(l.Id));
        var allCompleted = enrollment.Status == EnrollmentStatus.Completed;

        state = LearningStateMachine.Fire(state, allCompleted ? LearningTrigger.AllLessonsCompleted : LearningTrigger.NextLessonExists);

        int? certificateId = null;
        if (allCompleted)
        {
            await db.SaveChangesAsync(ct);
            var certificate = await certificates.GenerateAsync(enrollment.UserId, course, finalTestResultId, ct);
            state = LearningStateMachine.Fire(state, LearningTrigger.GenerateCertificate);
            certificateId = certificate.Id;
        }
        else
        {
            notifications.Notify(enrollment.UserId, NotificationType.Course,
                $"Урок «{lesson.Title}» зараховано. Прогрес курсу: {enrollment.Progress}%.",
                next is null ? $"/courses/{course.Id}" : $"/learn/lessons/{next.Id}");
        }

        return new LessonProgressDto(enrollment.Progress, allCompleted, next?.Id, certificateId, state);
    }

    public Task<Enrollment?> GetEnrollmentAsync(int userId, int courseId, CancellationToken ct, bool tracking = false)
    {
        var query = db.Enrollments.Include(e => e.CompletedLessons).AsQueryable();
        if (!tracking) query = query.AsNoTracking();
        return query.FirstOrDefaultAsync(e => e.UserId == userId && e.CourseId == courseId, ct);
    }

    public async Task<Course> LoadCourseAsync(int courseId, CancellationToken ct) =>
        await db.Courses
            .Include(c => c.Lessons).ThenInclude(l => l.Tests)
            .FirstOrDefaultAsync(c => c.Id == courseId, ct)
        ?? throw new NotFoundException("Курс не знайдено");

    private async Task<Lesson> LoadLessonAsync(int lessonId, CancellationToken ct, bool tracking = false)
    {
        IQueryable<Lesson> query = db.Lessons
            .Include(l => l.Tests).ThenInclude(t => t.Questions)
            .Include(l => l.Course!).ThenInclude(c => c.Lessons).ThenInclude(l => l.Tests)
            .Include(l => l.Course!).ThenInclude(c => c.Category)
            ;
        if (!tracking) query = query.AsNoTrackingWithIdentityResolution();
        return await query.FirstOrDefaultAsync(l => l.Id == lessonId, ct) ?? throw new NotFoundException("Урок не знайдено");
    }

    private int RequireStudent()
    {
        var userId = currentUser.RequireId();
        if (currentUser.Role != UserRole.Student)
            throw new ForbiddenAccessException("Проходити курси можуть лише студенти. Увійдіть зі студентського акаунта");
        return userId;
    }

    private static IReadOnlyList<RouteStopDto> Route(Course course, Enrollment? enrollment) =>
        course.OrderedLessons()
            .Select(l => new RouteStopDto(l.Id, l.Title, l.Tests.Count > 0, enrollment?.IsLessonCompleted(l.Id) ?? false))
            .ToList();

    public static EnrollmentDto ToDto(Enrollment e) => new(e.Id, e.CourseId, e.Status, e.Progress, e.EnrolledAt);
}
