using EduPath.Application.Abstractions;
using EduPath.Domain.Courses;
using EduPath.Domain.Learning;

namespace EduPath.Application.Courses;

public sealed record CourseCardDto(
    int Id,
    string Title,
    string Summary,
    decimal Price,
    CourseLevel Level,
    CourseStatus Status,
    int CategoryId,
    string CategoryName,
    TrailColor Trail,
    int TeacherId,
    string TeacherName,
    int LessonCount,
    int DurationMinutes,
    int StudentCount,
    double? Rating,
    int ReviewCount,
    DateTime? PublishedAt,
    DateTime UpdatedAt);

public static class CourseCards
{
    public static IQueryable<CourseCardDto> ToCards(this IQueryable<Course> source, IAppDbContext db) =>
        source.Select(c => new CourseCardDto(
            c.Id,
            c.Title,
            c.Summary,
            c.Price,
            c.Level,
            c.Status,
            c.CategoryId,
            c.Category!.Name,
            c.Category.Trail,
            c.TeacherId,
            c.Teacher!.Name,
            c.Lessons.Count,
            c.Lessons.Sum(l => l.DurationMinutes),
            db.Enrollments.Count(e => e.CourseId == c.Id && e.Status != EnrollmentStatus.Pending),
            c.Reviews.Average(r => (double?)r.Rating),
            c.Reviews.Count,
            c.PublishedAt,
            c.UpdatedAt));

    public static IQueryable<Course> WhereAvailable(this IQueryable<Course> source) =>
        source.Where(c => c.Status == CourseStatus.Published && c.Lessons.Any());
}
