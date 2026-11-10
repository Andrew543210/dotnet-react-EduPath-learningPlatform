using EduPath.Domain.Common;

namespace EduPath.Domain.Learning;

public enum EnrollmentStatus
{
    Pending,
    Active,
    Completed,
}

public class Enrollment : Entity
{
    private readonly List<LessonCompletion> _completedLessons = [];

    private Enrollment() { }

    public int UserId { get; private set; }
    public Users.User? User { get; private set; }
    public int CourseId { get; private set; }
    public Courses.Course? Course { get; private set; }

    public DateTime EnrolledAt { get; private set; }
    public DateTime? CompletedAt { get; private set; }
    public int Progress { get; private set; }
    public EnrollmentStatus Status { get; private set; } = EnrollmentStatus.Pending;
    public DateTime? LastActivityAt { get; private set; }

    public IReadOnlyCollection<LessonCompletion> CompletedLessons => _completedLessons;

    public bool HasAccess => Status is EnrollmentStatus.Active or EnrollmentStatus.Completed;

    public static Enrollment Create(int userId, int courseId, DateTime now) =>
        new() { UserId = userId, CourseId = courseId, EnrolledAt = now };

    public void Activate(DateTime now)
    {
        if (HasAccess) throw new DomainException("Ви вже маєте доступ до цього курсу");
        Status = EnrollmentStatus.Active;
        EnrolledAt = now;
        LastActivityAt = now;
    }

    public void UpdateProgress(int value, DateTime now)
    {
        if (!HasAccess) throw new DomainException("Запис на курс не активовано");
        Progress = Math.Clamp(value, 0, 100);
        LastActivityAt = now;
        if (Progress == 100 && Status != EnrollmentStatus.Completed)
        {
            Status = EnrollmentStatus.Completed;
            CompletedAt = now;
        }
    }

    public bool IsLessonCompleted(int lessonId) => _completedLessons.Any(c => c.LessonId == lessonId);

    internal bool RegisterLessonCompletion(int lessonId, DateTime now)
    {
        if (IsLessonCompleted(lessonId)) return false;
        _completedLessons.Add(new LessonCompletion(lessonId, now));
        return true;
    }

    public void RecalculateProgress(IReadOnlyCollection<int> courseLessonIds, DateTime now)
    {
        if (courseLessonIds.Count == 0) return;
        var completed = courseLessonIds.Count(IsLessonCompleted);
        UpdateProgress(completed == courseLessonIds.Count ? 100 : completed * 100 / courseLessonIds.Count, now);
    }
}

public class LessonCompletion
{
    private LessonCompletion() { }

    internal LessonCompletion(int lessonId, DateTime completedAt)
    {
        LessonId = lessonId;
        CompletedAt = completedAt;
    }

    public int Id { get; private set; }
    public int EnrollmentId { get; private set; }
    public int LessonId { get; private set; }
    public DateTime CompletedAt { get; private set; }
}
