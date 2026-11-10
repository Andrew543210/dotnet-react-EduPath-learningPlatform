using System.Reflection;
using System.Text.RegularExpressions;
using EduPath.Domain.Assessment;
using EduPath.Domain.Certificates;
using EduPath.Domain.Common;
using EduPath.Domain.Courses;
using EduPath.Domain.Learning;
using EduPath.Domain.Payments;

namespace EduPath.UnitTests.Domain;

public class LearningTests
{
    private static readonly DateTime Now = new(2026, 11, 9, 10, 0, 0, DateTimeKind.Utc);

    private static T WithId<T>(T entity, int id) where T : Entity
    {
        typeof(Entity).GetProperty(nameof(Entity.Id))!.SetValue(entity, id);
        return entity;
    }

    private static (Course Course, List<Lesson> Lessons) CourseWithLessons(int count)
    {
        var course = WithId(CourseTests.NewCourse(), 7);
        var lessons = Enumerable.Range(1, count).Select(i => WithId(course.AddLesson($"Урок {i}", "", 10), 100 + i)).ToList();
        foreach (var lesson in lessons) typeof(Lesson).GetProperty(nameof(Lesson.CourseId))!.SetValue(lesson, course.Id);
        return (course, lessons);
    }

    [Fact]
    public void Lesson_is_closed_without_active_enrollment()
    {
        var (course, lessons) = CourseWithLessons(1);
        var pending = Enrollment.Create(userId: 5, course.Id, Now);

        Assert.Throws<AccessDeniedException>(() => lessons[0].Open(null));
        Assert.Throws<AccessDeniedException>(() => lessons[0].Open(pending));
    }

    [Fact]
    public void Completing_lessons_updates_progress_and_finishes_course()
    {
        var (course, lessons) = CourseWithLessons(4);
        var enrollment = Enrollment.Create(5, course.Id, Now);
        enrollment.Activate(Now);
        var ids = lessons.Select(l => l.Id).ToList();

        Assert.True(lessons[0].MarkCompleted(enrollment, Now));
        Assert.False(lessons[0].MarkCompleted(enrollment, Now));
        enrollment.RecalculateProgress(ids, Now);
        Assert.Equal(25, enrollment.Progress);
        Assert.Equal(EnrollmentStatus.Active, enrollment.Status);

        foreach (var lesson in lessons.Skip(1)) lesson.MarkCompleted(enrollment, Now.AddHours(1));
        enrollment.RecalculateProgress(ids, Now.AddHours(1));

        Assert.Equal(100, enrollment.Progress);
        Assert.Equal(EnrollmentStatus.Completed, enrollment.Status);
        Assert.Equal(Now.AddHours(1), enrollment.CompletedAt);
    }

    [Fact]
    public void Enrollment_cannot_be_activated_twice()
    {
        var enrollment = Enrollment.Create(5, 7, Now);
        enrollment.Activate(Now);
        Assert.Throws<DomainException>(() => enrollment.Activate(Now));
    }

    private static Test NewTest(int passingScore = 70)
    {
        var (_, lessons) = CourseWithLessons(1);
        var test = WithId(lessons[0].AddTest("Тест", passingScore), 1);
        test.ReplaceQuestions(
        [
            ("2 + 2", ["3", "4"], "4", null),
            ("Столиця України", ["Київ", "Львів"], "Київ", null),
            ("SQL — це мова запитів?", ["Так", "Ні"], "Так", null),
            ("HTTP 404 означає", ["Не знайдено", "Помилка сервера"], "Не знайдено", null),
        ]);
        var id = 10;
        foreach (var q in test.Questions) WithId(q, id++);
        return test;
    }

    [Fact]
    public void TestResult_scores_answers_and_applies_threshold()
    {
        var test = NewTest(passingScore: 75);
        var answers = new Dictionary<int, string> { [10] = "4", [11] = "київ", [12] = "Ні" };

        var result = TestResult.Evaluate(userId: 5, test, answers, attemptNumber: 1, Now);

        Assert.Equal(50, result.Score);
        Assert.False(result.IsPassed());
        Assert.Equal(4, result.Answers.Count);
        Assert.Equal(2, result.Answers.Count(a => a.IsCorrect));
    }

    [Fact]
    public void TestResult_passes_at_threshold()
    {
        var test = NewTest(passingScore: 75);
        var answers = new Dictionary<int, string> { [10] = "4", [11] = "Київ", [12] = "Так", [13] = "Помилка сервера" };
        Assert.True(TestResult.Evaluate(5, test, answers, 2, Now).IsPassed());
    }

    [Fact]
    public void Question_requires_correct_answer_among_options()
    {
        var (_, lessons) = CourseWithLessons(1);
        var test = lessons[0].AddTest("Тест", 70);
        Assert.Throws<DomainException>(() => test.ReplaceQuestions([("Питання", ["A", "B"], "C", null)]));
        Assert.Throws<DomainException>(() => test.ReplaceQuestions([("Питання", ["A"], "A", null)]));
    }

    [Fact]
    public void Payment_for_free_course_is_rejected_and_processing_is_single_shot()
    {
        Assert.Throws<DomainException>(() => Payment.Create(5, CourseTests.NewCourse(price: 0), Now));

        var payment = Payment.Create(5, CourseTests.NewCourse(price: 690), Now);
        Assert.Equal(690m, payment.Amount);
        Assert.Equal("UAH", payment.Currency);

        Assert.False(payment.Process(false, null, "банк відхилив картку", "0002", Now));
        Assert.Equal(PaymentStatus.Failed, payment.Status);
        Assert.Throws<DomainException>(() => payment.Process(true, "pi_1", null, "4242", Now));
    }

    [Fact]
    public void Certificate_number_is_readable_and_unique()
    {
        var numbers = Enumerable.Range(0, 200).Select(_ => Certificate.Generate(5, 7, null, 90, Now).Number).ToList();

        Assert.All(numbers, n => Assert.Matches(new Regex(@"^EP-2026-[A-Z2-9]{4}-[A-Z2-9]{4}$"), n));
        Assert.DoesNotContain(numbers, n => n[8..].IndexOfAny(['O', '0', 'I', '1']) >= 0);
        Assert.Equal(numbers.Count, numbers.Distinct().Count());
    }
}

public class LearningStateMachineTests
{
    [Theory]
    [InlineData(LearningState.CourseNotPurchased, LearningTrigger.SelectCourse, LearningState.AwaitingPayment)]
    [InlineData(LearningState.AwaitingPayment, LearningTrigger.PayForCourse, LearningState.ProcessingPayment)]
    [InlineData(LearningState.ProcessingPayment, LearningTrigger.PaymentFailed, LearningState.AwaitingPayment)]
    [InlineData(LearningState.ProcessingPayment, LearningTrigger.PaymentSuccessful, LearningState.EnrolledInCourse)]
    [InlineData(LearningState.ViewingLesson, LearningTrigger.StartTest, LearningState.TakingTest)]
    [InlineData(LearningState.TakingTest, LearningTrigger.ResultBelowThreshold, LearningState.ViewingLesson)]
    [InlineData(LearningState.TakingTest, LearningTrigger.ResultAboveThreshold, LearningState.LessonCompleted)]
    [InlineData(LearningState.LessonCompleted, LearningTrigger.AllLessonsCompleted, LearningState.CourseCompleted)]
    [InlineData(LearningState.CourseCompleted, LearningTrigger.GenerateCertificate, LearningState.CertificateGenerated)]
    public void Transitions_follow_the_statechart(LearningState from, LearningTrigger trigger, LearningState to) =>
        Assert.Equal(to, LearningStateMachine.Fire(from, trigger));

    [Fact]
    public void Invalid_transition_throws()
    {
        Assert.False(LearningStateMachine.CanFire(LearningState.CourseNotPurchased, LearningTrigger.StartTest));
        Assert.Throws<DomainException>(() => LearningStateMachine.Fire(LearningState.CourseNotPurchased, LearningTrigger.GenerateCertificate));
    }

    [Fact]
    public void Resolve_maps_persisted_data_to_state()
    {
        var now = DateTime.UtcNow;
        Assert.Equal(LearningState.CourseNotPurchased, LearningStateMachine.Resolve(null, null, false));

        var enrollment = Enrollment.Create(1, 1, now);
        enrollment.Activate(now);
        Assert.Equal(LearningState.EnrolledInCourse, LearningStateMachine.Resolve(enrollment, null, false));

        enrollment.UpdateProgress(40, now);
        Assert.Equal(LearningState.CourseInProgress, LearningStateMachine.Resolve(enrollment, null, false));

        enrollment.UpdateProgress(100, now);
        Assert.Equal(LearningState.CertificateGenerated, LearningStateMachine.Resolve(enrollment, null, true));
    }

    [Fact]
    public void Every_state_except_final_has_an_outgoing_transition()
    {
        var withOutgoing = LearningStateMachine.All.Keys.Select(k => k.From).ToHashSet();
        var states = Enum.GetValues<LearningState>().Where(s => s != LearningState.Finished);
        Assert.All(states, s => Assert.Contains(s, withOutgoing));
    }
}
