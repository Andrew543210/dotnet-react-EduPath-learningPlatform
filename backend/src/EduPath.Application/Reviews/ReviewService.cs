using EduPath.Application.Abstractions;
using EduPath.Application.Common;
using EduPath.Domain.Learning;
using EduPath.Domain.Reviews;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace EduPath.Application.Reviews;

public sealed record ReviewDto(int Id, int CourseId, int Rating, string Comment, string AuthorName, DateTime CreatedAt, DateTime UpdatedAt, bool IsMine);

public sealed record ReviewSummaryDto(double? Average, int Count, IReadOnlyList<int> Distribution);

public sealed record CourseReviewsDto(ReviewSummaryDto Summary, PagedResult<ReviewDto> Page, ReviewDto? Mine);

public sealed record UpsertReviewRequest(int Rating, string? Comment);

public sealed record AdminReviewDto(int Id, int CourseId, string CourseTitle, int Rating, string Comment, string AuthorName, DateTime CreatedAt);

public sealed class ReviewService(IAppDbContext db, ICurrentUser currentUser)
{
    public async Task<CourseReviewsDto> GetForCourseAsync(int courseId, int? page, int? pageSize, CancellationToken ct)
    {
        var userId = currentUser.Id;
        var ratings = await db.Reviews.Where(r => r.CourseId == courseId).Select(r => r.Rating).ToListAsync(ct);
        var distribution = Enumerable.Range(1, 5).Select(star => ratings.Count(r => r == star)).ToList();
        var summary = new ReviewSummaryDto(ratings.Count == 0 ? null : Math.Round(ratings.Average(), 1), ratings.Count, distribution);

        var reviews = await db.Reviews.AsNoTracking()
            .Where(r => r.CourseId == courseId)
            .OrderByDescending(r => r.Comment != "").ThenByDescending(r => r.CreatedAt)
            .Select(r => new ReviewDto(r.Id, r.CourseId, r.Rating, r.Comment, r.User!.Name, r.CreatedAt, r.UpdatedAt, r.UserId == userId))
            .ToPagedAsync(page, pageSize, ct, defaultSize: 6);

        var mine = userId is null ? null : await db.Reviews.AsNoTracking()
            .Where(r => r.CourseId == courseId && r.UserId == userId)
            .Select(r => new ReviewDto(r.Id, r.CourseId, r.Rating, r.Comment, r.User!.Name, r.CreatedAt, r.UpdatedAt, true))
            .FirstOrDefaultAsync(ct);
        return new CourseReviewsDto(summary, reviews, mine);
    }

    public async Task<ReviewDto> UpsertMineAsync(int courseId, UpsertReviewRequest request, CancellationToken ct)
    {
        var userId = currentUser.RequireId();
        var enrolled = await db.Enrollments.AnyAsync(e => e.UserId == userId && e.CourseId == courseId
                                                         && e.Status != EnrollmentStatus.Pending, ct);
        if (!enrolled) throw new ForbiddenAccessException("Відгук можуть залишити лише студенти цього курсу");

        var review = await db.Reviews.Include(r => r.User).FirstOrDefaultAsync(r => r.CourseId == courseId && r.UserId == userId, ct);
        if (review is null)
        {
            review = Review.Create(courseId, userId, request.Rating, request.Comment);
            db.Reviews.Add(review);
        }
        else
        {
            review.Update(request.Rating, request.Comment);
        }
        await db.SaveChangesAsync(ct);

        var author = await db.Users.Where(u => u.Id == userId).Select(u => u.Name).FirstAsync(ct);
        return new ReviewDto(review.Id, courseId, review.Rating, review.Comment, author, review.CreatedAt, review.UpdatedAt, true);
    }

    public async Task DeleteMineAsync(int courseId, CancellationToken ct)
    {
        var userId = currentUser.RequireId();
        var review = await db.Reviews.FirstOrDefaultAsync(r => r.CourseId == courseId && r.UserId == userId, ct)
                     ?? throw new NotFoundException("Ви ще не залишали відгук на цей курс");
        db.Reviews.Remove(review);
        await db.SaveChangesAsync(ct);
    }

    public async Task<PagedResult<AdminReviewDto>> GetRecentAsync(int? page, int? pageSize, CancellationToken ct) =>
        await db.Reviews.AsNoTracking()
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new AdminReviewDto(r.Id, r.CourseId, db.Courses.Where(c => c.Id == r.CourseId).Select(c => c.Title).First(),
                r.Rating, r.Comment, r.User!.Name, r.CreatedAt))
            .ToPagedAsync(page, pageSize, ct, defaultSize: 20);

    public async Task DeleteAsync(int reviewId, CancellationToken ct)
    {
        var review = await db.Reviews.FirstOrDefaultAsync(r => r.Id == reviewId, ct) ?? throw new NotFoundException("Відгук не знайдено");
        db.Reviews.Remove(review);
        await db.SaveChangesAsync(ct);
    }
}

public sealed class UpsertReviewRequestValidator : AbstractValidator<UpsertReviewRequest>
{
    public UpsertReviewRequestValidator()
    {
        RuleFor(x => x.Rating).InclusiveBetween(1, 5).WithMessage("Оберіть оцінку від 1 до 5");
        RuleFor(x => x.Comment).MaximumLength(2000).WithMessage("Відгук не може бути довшим за 2000 символів");
    }
}
