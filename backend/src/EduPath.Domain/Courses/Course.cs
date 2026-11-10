using EduPath.Domain.Common;
using EduPath.Domain.Reviews;

namespace EduPath.Domain.Courses;

public enum CourseStatus
{
    Draft,
    PendingReview,
    Published,
    Rejected,
    Archived,
}

public enum CourseLevel
{
    Beginner,
    Intermediate,
    Advanced,
}

public class Course : AuditableEntity
{
    public const int TitleMaxLength = 160;
    public const int SummaryMaxLength = 300;
    public const decimal MaxPrice = 100_000m;

    private readonly List<Lesson> _lessons = [];
    private readonly List<Review> _reviews = [];
    private List<string> _outcomes = [];

    private Course() { }

    public string Title { get; private set; } = "";
    public string Summary { get; private set; } = "";
    public string Description { get; private set; } = "";
    public decimal Price { get; private set; }
    public CourseLevel Level { get; private set; }
    public CourseStatus Status { get; private set; } = CourseStatus.Draft;
    public string? ModerationComment { get; private set; }
    public DateTime? PublishedAt { get; private set; }

    public int CategoryId { get; private set; }
    public Category? Category { get; private set; }
    public int TeacherId { get; private set; }
    public Users.User? Teacher { get; private set; }

    public IReadOnlyList<string> Outcomes => _outcomes;
    public IReadOnlyCollection<Lesson> Lessons => _lessons;
    public IReadOnlyCollection<Review> Reviews => _reviews;

    public bool IsFree => Price <= 0;
    public int TotalDurationMinutes => _lessons.Sum(l => l.DurationMinutes);

    public static Course Create(int teacherId, int categoryId, string title, string summary, string description,
        decimal price, CourseLevel level, IEnumerable<string>? outcomes = null)
    {
        var course = new Course { TeacherId = teacherId };
        course.UpdateDetails(categoryId, title, summary, description, price, level, outcomes ?? []);
        return course;
    }

    public void UpdateDetails(int categoryId, string title, string summary, string description, decimal price,
        CourseLevel level, IEnumerable<string> outcomes)
    {
        if (price < 0 || price > MaxPrice) throw new DomainException($"Ціна має бути від 0 до {MaxPrice:0} грн");
        CategoryId = categoryId;
        Title = Guard.NotEmpty(title, "Вкажіть назву курсу", TitleMaxLength);
        Summary = Guard.NotEmpty(summary, "Додайте короткий опис курсу", SummaryMaxLength);
        Description = description?.Trim() ?? "";
        Price = decimal.Round(price, 2);
        Level = level;
        _outcomes = outcomes.Select(o => o.Trim()).Where(o => o.Length > 0).Distinct().Take(12).ToList();
    }

    public bool IsAvailable() => Status == CourseStatus.Published && _lessons.Count > 0;

    public string GetDetails() =>
        $"{Title}: {_lessons.Count} уроків, {(IsFree ? "безкоштовно" : $"{Price:0.##} грн")}";

    public IEnumerable<Lesson> OrderedLessons() => _lessons.OrderBy(l => l.OrderNumber);

    public Lesson AddLesson(string title, string content, int durationMinutes, string? videoUrl = null)
    {
        EnsureEditable();
        var order = _lessons.Count == 0 ? 1 : _lessons.Max(l => l.OrderNumber) + 1;
        var lesson = Lesson.Create(this, order, title, content, durationMinutes, videoUrl);
        _lessons.Add(lesson);
        return lesson;
    }

    public void RemoveLesson(Lesson lesson)
    {
        EnsureEditable();
        if (!_lessons.Remove(lesson)) throw new DomainException("Урок не належить цьому курсу");
        Renumber();
    }

    public void MoveLesson(Lesson lesson, int newPosition)
    {
        EnsureEditable();
        var ordered = OrderedLessons().ToList();
        if (!ordered.Remove(lesson)) throw new DomainException("Урок не належить цьому курсу");
        ordered.Insert(Math.Clamp(newPosition, 1, ordered.Count + 1) - 1, lesson);
        for (var i = 0; i < ordered.Count; i++) ordered[i].SetOrder(i + 1);
    }

    private void Renumber()
    {
        var i = 1;
        foreach (var l in OrderedLessons().ToList()) l.SetOrder(i++);
    }

    private void EnsureEditable()
    {
        if (Status == CourseStatus.Archived) throw new DomainException("Архівний курс не можна змінювати");
    }

    public void SubmitForReview(bool moderationRequired, DateTime now)
    {
        if (_lessons.Count == 0) throw new DomainException("Додайте хоча б один урок перед публікацією");
        if (Status is CourseStatus.PendingReview or CourseStatus.Published)
            throw new DomainException("Курс уже опубліковано або він чекає на перевірку");

        ModerationComment = null;
        if (moderationRequired) Status = CourseStatus.PendingReview;
        else Publish(now);
    }

    public void Approve(DateTime now)
    {
        if (Status != CourseStatus.PendingReview) throw new DomainException("Курс не чекає на перевірку");
        Publish(now);
    }

    public void Reject(string comment)
    {
        if (Status != CourseStatus.PendingReview) throw new DomainException("Курс не чекає на перевірку");
        Status = CourseStatus.Rejected;
        ModerationComment = Guard.NotEmpty(comment, "Поясніть викладачу причину відхилення", 1000);
    }

    public void Archive()
    {
        if (Status == CourseStatus.Archived) return;
        Status = CourseStatus.Archived;
    }

    private void Publish(DateTime now)
    {
        Status = CourseStatus.Published;
        ModerationComment = null;
        PublishedAt ??= now;
    }

    public double? AverageRating() => _reviews.Count == 0 ? null : Math.Round(_reviews.Average(r => r.Rating), 1);
}
