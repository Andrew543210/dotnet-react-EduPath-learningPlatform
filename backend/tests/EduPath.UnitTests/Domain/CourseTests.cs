using EduPath.Domain.Common;
using EduPath.Domain.Courses;

namespace EduPath.UnitTests.Domain;

public class CourseTests
{
    private static readonly DateTime Now = new(2026, 11, 9, 10, 0, 0, DateTimeKind.Utc);

    internal static Course NewCourse(decimal price = 490m) =>
        Course.Create(teacherId: 1, categoryId: 1, "Типографіка", "Короткий опис", "Опис", price, CourseLevel.Beginner, ["Результат"]);

    [Fact]
    public void AddLesson_numbers_lessons_sequentially()
    {
        var course = NewCourse();
        course.AddLesson("Перший", "", 10);
        course.AddLesson("Другий", "", 10);
        course.AddLesson("Третій", "", 10);

        Assert.Equal(["Перший", "Другий", "Третій"], course.OrderedLessons().Select(l => l.Title));
        Assert.Equal([1, 2, 3], course.OrderedLessons().Select(l => l.OrderNumber));
        Assert.Equal(30, course.TotalDurationMinutes);
    }

    [Fact]
    public void MoveLesson_reorders_and_renumbers()
    {
        var course = NewCourse();
        var first = course.AddLesson("A", "", 5);
        course.AddLesson("B", "", 5);
        course.AddLesson("C", "", 5);

        course.MoveLesson(first, 3);

        Assert.Equal(["B", "C", "A"], course.OrderedLessons().Select(l => l.Title));
        Assert.Equal([1, 2, 3], course.OrderedLessons().Select(l => l.OrderNumber));
    }

    [Fact]
    public void SubmitForReview_without_lessons_is_rejected()
    {
        var course = NewCourse();
        var error = Assert.Throws<DomainException>(() => course.SubmitForReview(moderationRequired: true, Now));
        Assert.Contains("урок", error.Message);
    }

    [Fact]
    public void Moderation_flow_publishes_course()
    {
        var course = NewCourse();
        course.AddLesson("Урок", "", 10);

        course.SubmitForReview(moderationRequired: true, Now);
        Assert.Equal(CourseStatus.PendingReview, course.Status);
        Assert.False(course.IsAvailable());

        course.Approve(Now);
        Assert.Equal(CourseStatus.Published, course.Status);
        Assert.Equal(Now, course.PublishedAt);
        Assert.True(course.IsAvailable());
    }

    [Fact]
    public void Without_moderation_course_is_published_immediately()
    {
        var course = NewCourse();
        course.AddLesson("Урок", "", 10);
        course.SubmitForReview(moderationRequired: false, Now);
        Assert.Equal(CourseStatus.Published, course.Status);
    }

    [Fact]
    public void Rejected_course_keeps_moderation_comment_and_can_be_resubmitted()
    {
        var course = NewCourse();
        course.AddLesson("Урок", "", 10);
        course.SubmitForReview(true, Now);
        course.Reject("Додайте практичне завдання");

        Assert.Equal(CourseStatus.Rejected, course.Status);
        Assert.Equal("Додайте практичне завдання", course.ModerationComment);

        course.SubmitForReview(true, Now);
        Assert.Equal(CourseStatus.PendingReview, course.Status);
        Assert.Null(course.ModerationComment);
    }

    [Fact]
    public void Approve_requires_pending_review()
    {
        var course = NewCourse();
        course.AddLesson("Урок", "", 10);
        Assert.Throws<DomainException>(() => course.Approve(Now));
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(100_001)]
    public void Price_outside_range_is_rejected(decimal price) =>
        Assert.Throws<DomainException>(() => NewCourse(price));

    [Fact]
    public void Archived_course_cannot_be_edited()
    {
        var course = NewCourse();
        course.Archive();
        Assert.Throws<DomainException>(() => course.AddLesson("Ще один", "", 10));
    }
}
