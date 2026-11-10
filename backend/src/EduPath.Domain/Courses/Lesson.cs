using EduPath.Domain.Assessment;
using EduPath.Domain.Common;
using EduPath.Domain.Learning;

namespace EduPath.Domain.Courses;

public class Lesson : Entity
{
    private readonly List<Test> _tests = [];

    private Lesson() { }

    public int CourseId { get; private set; }
    public Course? Course { get; private set; }
    public string Title { get; private set; } = "";
    public string Content { get; private set; } = "";
    public int OrderNumber { get; private set; }
    public int DurationMinutes { get; private set; }
    public string? VideoUrl { get; private set; }
    public string? MaterialUrl { get; private set; }
    public string? MaterialName { get; private set; }

    public IReadOnlyCollection<Test> Tests => _tests;

    internal static Lesson Create(Course course, int order, string title, string content, int durationMinutes, string? videoUrl)
    {
        var lesson = new Lesson { Course = course, OrderNumber = order };
        lesson.Update(title, content, durationMinutes, videoUrl);
        return lesson;
    }

    public void Update(string title, string content, int durationMinutes, string? videoUrl)
    {
        Title = Guard.NotEmpty(title, "Вкажіть назву уроку", 160);
        Content = content?.Trim() ?? "";
        DurationMinutes = Guard.InRange(durationMinutes, 1, 600, "Тривалість уроку — від 1 до 600 хвилин");
        VideoUrl = string.IsNullOrWhiteSpace(videoUrl) ? null : videoUrl.Trim();
    }

    public void AttachMaterial(string url, string fileName)
    {
        MaterialUrl = url;
        MaterialName = fileName;
    }

    public void RemoveMaterial()
    {
        MaterialUrl = null;
        MaterialName = null;
    }

    internal void SetOrder(int order) => OrderNumber = order;

    public void Open(Enrollment? enrollment)
    {
        if (enrollment is null || enrollment.CourseId != CourseId || !enrollment.HasAccess)
            throw new AccessDeniedException("Урок доступний після запису на курс");
    }

    public bool MarkCompleted(Enrollment enrollment, DateTime now)
    {
        Open(enrollment);
        return enrollment.RegisterLessonCompletion(Id, now);
    }

    public Test AddTest(string title, int passingScore)
    {
        var test = Test.Create(this, title, passingScore);
        _tests.Add(test);
        return test;
    }

    public void RemoveTest(Test test)
    {
        if (!_tests.Remove(test)) throw new DomainException("Тест не належить цьому уроку");
    }
}
