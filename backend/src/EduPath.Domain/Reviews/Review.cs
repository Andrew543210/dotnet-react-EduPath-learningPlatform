using EduPath.Domain.Common;

namespace EduPath.Domain.Reviews;

public class Review : AuditableEntity
{
    private Review() { }

    public int CourseId { get; private set; }
    public int UserId { get; private set; }
    public Users.User? User { get; private set; }
    public int Rating { get; private set; }
    public string Comment { get; private set; } = "";

    public static Review Create(int courseId, int userId, int rating, string? comment)
    {
        var review = new Review { CourseId = courseId, UserId = userId };
        review.Update(rating, comment);
        return review;
    }

    public void Update(int rating, string? comment)
    {
        Rating = Guard.InRange(rating, 1, 5, "Оцінка має бути від 1 до 5");
        Comment = comment?.Trim() ?? "";
        if (Comment.Length > 2000) throw new DomainException("Відгук не може бути довшим за 2000 символів");
    }
}
