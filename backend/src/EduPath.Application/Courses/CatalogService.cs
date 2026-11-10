using EduPath.Application.Abstractions;
using EduPath.Application.Common;
using EduPath.Domain.Courses;
using EduPath.Domain.Learning;
using EduPath.Domain.Users;
using Microsoft.EntityFrameworkCore;

namespace EduPath.Application.Courses;

public enum PriceFilter
{
    Any,
    Free,
    Paid,
}

public enum CourseSort
{
    Popular,
    Newest,
    Rating,
    PriceAsc,
    PriceDesc,
}

public sealed record CourseSearchQuery(
    string? Search,
    int? CategoryId,
    CourseLevel? Level,
    PriceFilter Price = PriceFilter.Any,
    CourseSort Sort = CourseSort.Popular,
    int? Page = 1,
    int? PageSize = 12);

public sealed record CategoryDto(int Id, string Name, string Slug, string Description, TrailColor Trail, int CourseCount);

public sealed record TeacherDto(int Id, string Name, string? Headline, string? Bio, int CourseCount, int StudentCount);

public sealed record SyllabusLessonDto(int Id, string Title, int OrderNumber, int DurationMinutes, bool HasTest, bool IsCompleted);

public sealed record LearnerStateDto(
    LearningState State,
    EnrollmentStatus? EnrollmentStatus,
    int Progress,
    int? NextLessonId,
    int? CertificateId,
    bool CanReview);

public sealed record CourseDetailsDto(
    CourseCardDto Course,
    string Description,
    IReadOnlyList<string> Outcomes,
    TeacherDto Teacher,
    IReadOnlyList<SyllabusLessonDto> Lessons,
    int TestCount,
    LearnerStateDto? Learner,
    bool IsPreview,
    string? ModerationComment);

public sealed class CatalogService(IAppDbContext db, ICurrentUser currentUser)
{
    public async Task<IReadOnlyList<CategoryDto>> GetCategoriesAsync(CancellationToken ct) =>
        await db.Categories.AsNoTracking()
            .OrderBy(c => c.Name)
            .Select(c => new CategoryDto(c.Id, c.Name, c.Slug, c.Description, c.Trail,
                c.Courses.Count(x => x.Status == CourseStatus.Published && x.Lessons.Any())))
            .ToListAsync(ct);

    public async Task<PagedResult<CourseCardDto>> SearchAsync(CourseSearchQuery query, CancellationToken ct)
    {
        var courses = db.Courses.AsNoTracking().WhereAvailable();

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLower();
            courses = courses.Where(c => c.Title.ToLower().Contains(term)
                                         || c.Summary.ToLower().Contains(term)
                                         || c.Teacher!.Name.ToLower().Contains(term));
        }
        if (query.CategoryId is not null) courses = courses.Where(c => c.CategoryId == query.CategoryId);
        if (query.Level is not null) courses = courses.Where(c => c.Level == query.Level);
        courses = query.Price switch
        {
            PriceFilter.Free => courses.Where(c => c.Price == 0),
            PriceFilter.Paid => courses.Where(c => c.Price > 0),
            _ => courses,
        };

        courses = query.Sort switch
        {
            CourseSort.Newest => courses.OrderByDescending(c => c.PublishedAt).ThenByDescending(c => c.Id),
            CourseSort.Rating => courses.OrderByDescending(c => c.Reviews.Average(r => (double?)r.Rating) ?? 0)
                .ThenByDescending(c => c.Reviews.Count).ThenBy(c => c.Id),
            CourseSort.PriceAsc => courses.OrderBy(c => c.Price).ThenBy(c => c.Id),
            CourseSort.PriceDesc => courses.OrderByDescending(c => c.Price).ThenBy(c => c.Id),
            _ => courses.OrderByDescending(c => db.Enrollments.Count(e => e.CourseId == c.Id && e.Status != EnrollmentStatus.Pending))
                .ThenByDescending(c => c.Reviews.Average(r => (double?)r.Rating) ?? 0).ThenBy(c => c.Id),
        };
        return await courses.ToCards(db).ToPagedAsync(query.Page, query.PageSize, ct);
    }

    public async Task<CourseDetailsDto> GetCourseAsync(int courseId, CancellationToken ct)
    {
        var course = await db.Courses.AsNoTracking()
                         .Include(c => c.Lessons).ThenInclude(l => l.Tests)
                         .FirstOrDefaultAsync(c => c.Id == courseId, ct)
                     ?? throw new NotFoundException("Курс не знайдено");

        var userId = currentUser.Id;
        var isOwner = userId == course.TeacherId || currentUser.IsAdmin();
        if (!course.IsAvailable() && !isOwner && !await HasAccessAsync(userId, courseId, ct))
            throw new NotFoundException("Курс не знайдено або ще не опублікований");

        var card = await db.Courses.Where(c => c.Id == courseId).ToCards(db).FirstAsync(ct);
        var teacher = await db.Users.AsNoTracking()
            .Where(u => u.Id == course.TeacherId)
            .Select(u => new TeacherDto(u.Id, u.Name, u.Headline, u.Bio,
                db.Courses.Count(c => c.TeacherId == u.Id && c.Status == CourseStatus.Published),
                db.Enrollments.Count(e => e.Course!.TeacherId == u.Id && e.Status != EnrollmentStatus.Pending)))
            .FirstAsync(ct);

        LearnerStateDto? learner = null;
        Enrollment? enrollment = null;
        if (userId is not null && currentUser.Role == UserRole.Student)
        {
            enrollment = await db.Enrollments.AsNoTracking().Include(e => e.CompletedLessons)
                .FirstOrDefaultAsync(e => e.UserId == userId && e.CourseId == courseId, ct);
            var lastPayment = await db.Payments.AsNoTracking()
                .Where(p => p.UserId == userId && p.CourseId == courseId)
                .OrderByDescending(p => p.Id).FirstOrDefaultAsync(ct);
            var certificateId = await db.Certificates
                .Where(c => c.UserId == userId && c.CourseId == courseId)
                .Select(c => (int?)c.Id).FirstOrDefaultAsync(ct);

            var next = enrollment is null ? null : course.OrderedLessons().FirstOrDefault(l => !enrollment.IsLessonCompleted(l.Id));
            learner = new LearnerStateDto(
                LearningStateMachine.Resolve(enrollment, lastPayment, certificateId is not null),
                enrollment?.Status,
                enrollment?.Progress ?? 0,
                next?.Id ?? (enrollment?.HasAccess == true ? course.OrderedLessons().First().Id : null),
                certificateId,
                enrollment?.HasAccess == true);
        }

        var lessons = course.OrderedLessons()
            .Select(l => new SyllabusLessonDto(l.Id, l.Title, l.OrderNumber, l.DurationMinutes, l.Tests.Count > 0,
                enrollment?.IsLessonCompleted(l.Id) ?? false))
            .ToList();

        return new CourseDetailsDto(card, course.Description, course.Outcomes, teacher, lessons,
            course.Lessons.Sum(l => l.Tests.Count), learner, isOwner && !course.IsAvailable(),
            isOwner ? course.ModerationComment : null);
    }

    public async Task<(TeacherDto Teacher, IReadOnlyList<CourseCardDto> Courses)> GetTeacherAsync(int teacherId, CancellationToken ct)
    {
        var teacher = await db.Users.AsNoTracking()
            .Where(u => u.Id == teacherId && u.Role != UserRole.Student)
            .Select(u => new TeacherDto(u.Id, u.Name, u.Headline, u.Bio,
                db.Courses.Count(c => c.TeacherId == u.Id && c.Status == CourseStatus.Published),
                db.Enrollments.Count(e => e.Course!.TeacherId == u.Id && e.Status != EnrollmentStatus.Pending)))
            .FirstOrDefaultAsync(ct) ?? throw new NotFoundException("Викладача не знайдено");

        var courses = await db.Courses.AsNoTracking().WhereAvailable().Where(c => c.TeacherId == teacherId)
            .ToCards(db).ToListAsync(ct);
        return (teacher, courses.OrderByDescending(c => c.StudentCount).ToList());
    }

    private async Task<bool> HasAccessAsync(int? userId, int courseId, CancellationToken ct) =>
        userId is not null && await db.Enrollments.AnyAsync(e =>
            e.UserId == userId && e.CourseId == courseId && e.Status != EnrollmentStatus.Pending, ct);
}
