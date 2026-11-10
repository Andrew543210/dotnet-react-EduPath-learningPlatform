using EduPath.Domain.Common;
using EduPath.Domain.Payments;

namespace EduPath.Domain.Learning;

public enum LearningState
{
    CourseNotPurchased,
    AwaitingPayment,
    ProcessingPayment,
    EnrolledInCourse,
    CourseInProgress,
    ViewingLesson,
    TakingTest,
    LessonCompleted,
    CourseCompleted,
    CertificateGenerated,
    Finished,
}

public enum LearningTrigger
{
    SelectCourse,
    EnrollFree,
    PayForCourse,
    PaymentFailed,
    PaymentSuccessful,
    OpenCourse,
    SelectLesson,
    StartTest,
    MarkLessonCompleted,
    ResultBelowThreshold,
    ResultAboveThreshold,
    NextLessonExists,
    AllLessonsCompleted,
    GenerateCertificate,
    Finish,
}

public static class LearningStateMachine
{
    private static readonly Dictionary<(LearningState From, LearningTrigger Trigger), LearningState> Transitions = new()
    {
        [(LearningState.CourseNotPurchased, LearningTrigger.SelectCourse)] = LearningState.AwaitingPayment,
        [(LearningState.CourseNotPurchased, LearningTrigger.EnrollFree)] = LearningState.EnrolledInCourse,
        [(LearningState.AwaitingPayment, LearningTrigger.PayForCourse)] = LearningState.ProcessingPayment,
        [(LearningState.ProcessingPayment, LearningTrigger.PaymentFailed)] = LearningState.AwaitingPayment,
        [(LearningState.ProcessingPayment, LearningTrigger.PaymentSuccessful)] = LearningState.EnrolledInCourse,
        [(LearningState.EnrolledInCourse, LearningTrigger.OpenCourse)] = LearningState.CourseInProgress,
        [(LearningState.CourseInProgress, LearningTrigger.SelectLesson)] = LearningState.ViewingLesson,
        [(LearningState.ViewingLesson, LearningTrigger.StartTest)] = LearningState.TakingTest,
        [(LearningState.ViewingLesson, LearningTrigger.MarkLessonCompleted)] = LearningState.LessonCompleted,
        [(LearningState.TakingTest, LearningTrigger.ResultBelowThreshold)] = LearningState.ViewingLesson,
        [(LearningState.TakingTest, LearningTrigger.ResultAboveThreshold)] = LearningState.LessonCompleted,
        [(LearningState.LessonCompleted, LearningTrigger.NextLessonExists)] = LearningState.ViewingLesson,
        [(LearningState.LessonCompleted, LearningTrigger.AllLessonsCompleted)] = LearningState.CourseCompleted,
        [(LearningState.CourseCompleted, LearningTrigger.GenerateCertificate)] = LearningState.CertificateGenerated,
        [(LearningState.CertificateGenerated, LearningTrigger.Finish)] = LearningState.Finished,
    };

    public static IReadOnlyDictionary<(LearningState From, LearningTrigger Trigger), LearningState> All => Transitions;

    public static bool CanFire(LearningState state, LearningTrigger trigger) => Transitions.ContainsKey((state, trigger));

    public static LearningState Fire(LearningState state, LearningTrigger trigger) =>
        Transitions.TryGetValue((state, trigger), out var next)
            ? next
            : throw new DomainException($"Недопустимий перехід зі стану {state} за подією {trigger}");

    public static LearningState Resolve(Enrollment? enrollment, Payment? lastPayment, bool hasCertificate)
    {
        if (enrollment is null || !enrollment.HasAccess)
        {
            return lastPayment?.Status switch
            {
                PaymentStatus.Pending => LearningState.ProcessingPayment,
                PaymentStatus.Failed => LearningState.AwaitingPayment,
                _ => LearningState.CourseNotPurchased,
            };
        }

        if (enrollment.Status == EnrollmentStatus.Completed)
            return hasCertificate ? LearningState.CertificateGenerated : LearningState.CourseCompleted;

        return enrollment.CompletedLessons.Count == 0 && enrollment.Progress == 0
            ? LearningState.EnrolledInCourse
            : LearningState.CourseInProgress;
    }
}
