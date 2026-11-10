using EduPath.Application.Abstractions;
using EduPath.Application.Common;
using EduPath.Domain.Learning;
using EduPath.Domain.Payments;
using Microsoft.EntityFrameworkCore;

namespace EduPath.Application.Teaching;

public sealed record WeeklyPointDto(DateTime WeekStart, decimal Value);

public sealed record TeacherOverviewDto(
    int CourseCount,
    int PublishedCount,
    int StudentCount,
    int CompletedCount,
    int? AverageScore,
    double? AverageRating,
    decimal Revenue,
    IReadOnlyList<WeeklyPointDto> EnrollmentsByWeek);

public sealed record CourseStatsDto(int StudentCount, int CompletedCount, int AverageProgress, int? AverageScore, decimal Revenue, double? Rating);

public sealed record StudentProgressDto(int UserId, string Name, string Email, int Progress, EnrollmentStatus Status,
    DateTime EnrolledAt, DateTime? LastActivityAt, int Attempts, int? AverageScore, bool HasCertificate);

public sealed record LessonFunnelDto(int LessonId, int OrderNumber, string Title, int CompletedCount);

public sealed record CourseStudentsDto(string CourseTitle, CourseStatsDto Stats, IReadOnlyList<StudentProgressDto> Students,
    IReadOnlyList<LessonFunnelDto> Funnel);

public sealed class TeachingAnalyticsService(IAppDbContext db, ICurrentUser currentUser, TimeProvider time)
{
    public const int Weeks = 12;

    public async Task<TeacherOverviewDto> GetOverviewAsync(CancellationToken ct)
    {
        var teacherId = currentUser.RequireId();
        var courses = await db.Courses.Where(c => c.TeacherId == teacherId).Select(c => new { c.Id, c.Status }).ToListAsync(ct);
        var courseIds = courses.Select(c => c.Id).ToList();

        var enrollments = await db.Enrollments
            .Where(e => courseIds.Contains(e.CourseId) && e.Status != EnrollmentStatus.Pending)
            .Select(e => new { e.UserId, e.Status, e.EnrolledAt }).ToListAsync(ct);
        var scores = await db.TestResults.Where(r => courseIds.Contains(r.Test!.Lesson!.CourseId)).Select(r => r.Score).ToListAsync(ct);
        var ratings = await db.Reviews.Where(r => courseIds.Contains(r.CourseId)).Select(r => r.Rating).ToListAsync(ct);
        var revenue = await db.Payments.Where(p => courseIds.Contains(p.CourseId) && p.Status == PaymentStatus.Succeeded)
            .SumAsync(p => p.Amount, ct);

        return new TeacherOverviewDto(
            courses.Count,
            courses.Count(c => c.Status == Domain.Courses.CourseStatus.Published),
            enrollments.Select(e => e.UserId).Distinct().Count(),
            enrollments.Count(e => e.Status == EnrollmentStatus.Completed),
            scores.Count == 0 ? null : (int)Math.Round(scores.Average()),
            ratings.Count == 0 ? null : Math.Round(ratings.Average(), 1),
            revenue,
            WeeklySeries(enrollments.Select(e => (e.EnrolledAt, 1m)), time.UtcNow()));
    }

    public async Task<CourseStudentsDto> GetCourseStudentsAsync(int courseId, CancellationToken ct)
    {
        var userId = currentUser.RequireId();
        var course = await db.Courses.AsNoTracking().Include(c => c.Lessons).ThenInclude(l => l.Tests)
                         .FirstOrDefaultAsync(c => c.Id == courseId, ct)
                     ?? throw new NotFoundException("Курс не знайдено");
        if (course.TeacherId != userId && !currentUser.IsAdmin()) throw new ForbiddenAccessException("Статистика доступна лише автору курсу");

        var testIds = course.Lessons.SelectMany(l => l.Tests).Select(t => t.Id).ToList();
        var enrollments = await db.Enrollments.AsNoTracking()
            .Include(e => e.User).Include(e => e.CompletedLessons)
            .Where(e => e.CourseId == courseId && e.Status != EnrollmentStatus.Pending)
            .OrderByDescending(e => e.LastActivityAt ?? e.EnrolledAt)
            .ToListAsync(ct);
        var results = await db.TestResults.Where(r => testIds.Contains(r.TestId)).Select(r => new { r.UserId, r.Score }).ToListAsync(ct);
        var certified = (await db.Certificates.Where(c => c.CourseId == courseId).Select(c => c.UserId).ToListAsync(ct)).ToHashSet();
        var revenue = await db.Payments.Where(p => p.CourseId == courseId && p.Status == PaymentStatus.Succeeded).SumAsync(p => p.Amount, ct);
        var ratings = await db.Reviews.Where(r => r.CourseId == courseId).Select(r => r.Rating).ToListAsync(ct);

        var students = enrollments.Select(e =>
        {
            var mine = results.Where(r => r.UserId == e.UserId).ToList();
            return new StudentProgressDto(e.UserId, e.User!.Name, e.User.Email, e.Progress, e.Status, e.EnrolledAt, e.LastActivityAt,
                mine.Count, mine.Count == 0 ? null : (int)Math.Round(mine.Average(r => r.Score)), certified.Contains(e.UserId));
        }).ToList();

        var funnel = course.OrderedLessons()
            .Select(l => new LessonFunnelDto(l.Id, l.OrderNumber, l.Title, enrollments.Count(e => e.IsLessonCompleted(l.Id))))
            .ToList();

        var stats = new CourseStatsDto(
            students.Count,
            students.Count(s => s.Status == EnrollmentStatus.Completed),
            students.Count == 0 ? 0 : (int)Math.Round(students.Average(s => s.Progress)),
            results.Count == 0 ? null : (int)Math.Round(results.Average(r => r.Score)),
            revenue,
            ratings.Count == 0 ? null : Math.Round(ratings.Average(), 1));

        return new CourseStudentsDto(course.Title, stats, students, funnel);
    }

    public static IReadOnlyList<WeeklyPointDto> WeeklySeries(IEnumerable<(DateTime At, decimal Value)> events, DateTime now, int weeks = Weeks)
    {
        var currentWeek = WeekStart(now);
        var buckets = Enumerable.Range(0, weeks).Select(i => currentWeek.AddDays(-7 * (weeks - 1 - i))).ToList();
        var sums = events.GroupBy(e => WeekStart(e.At)).ToDictionary(g => g.Key, g => g.Sum(e => e.Value));
        return buckets.Select(b => new WeeklyPointDto(b, sums.GetValueOrDefault(b))).ToList();
    }

    private static DateTime WeekStart(DateTime at)
    {
        var date = DateTime.SpecifyKind(at.Date, DateTimeKind.Utc);
        var offset = ((int)date.DayOfWeek + 6) % 7;
        return date.AddDays(-offset);
    }
}
