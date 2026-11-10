using EduPath.Application.Abstractions;
using EduPath.Application.Common;
using EduPath.Application.Learning;
using EduPath.Application.Notifications;
using EduPath.Domain.Assessment;
using EduPath.Domain.Learning;
using EduPath.Domain.Notifications;
using EduPath.Domain.Users;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace EduPath.Application.Testing;

public sealed record QuestionDto(int Id, string Text, IReadOnlyList<string> Options);

public sealed record TestSessionDto(
    int Id,
    string Title,
    int LessonId,
    string LessonTitle,
    int CourseId,
    string CourseTitle,
    int PassingScore,
    int AttemptNumber,
    IReadOnlyList<QuestionDto> Questions);

public sealed record SubmitAnswersRequest(Dictionary<int, string> Answers);

public sealed record AnswerReviewDto(int QuestionId, string Question, string SelectedAnswer, bool IsCorrect,
    string? CorrectAnswer, string? Explanation);

public sealed record TestResultDto(
    int Id,
    int TestId,
    string TestTitle,
    int LessonId,
    string LessonTitle,
    int CourseId,
    string CourseTitle,
    int Score,
    bool Passed,
    int PassingScore,
    int AttemptNumber,
    DateTime CompletedAt,
    int CorrectCount,
    int TotalCount,
    int CourseProgress,
    LearningState NextState,
    int? NextLessonId,
    int? CertificateId,
    IReadOnlyList<AnswerReviewDto> Answers);

public sealed record ResultSummaryDto(int Id, int TestId, string TestTitle, string CourseTitle, int Score, bool Passed, DateTime CompletedAt);

public sealed class TestingService(
    IAppDbContext db,
    ICurrentUser currentUser,
    LearningService learning,
    NotificationService notifications,
    TimeProvider time)
{
    public async Task<TestSessionDto> GetTestAsync(int testId, CancellationToken ct)
    {
        var userId = currentUser.RequireId();
        var test = await LoadTestAsync(testId, ct, tracking: false);
        var lesson = test.Lesson!;
        if (lesson.Course!.TeacherId != userId && !currentUser.IsAdmin())
            lesson.Open(await learning.GetEnrollmentAsync(userId, lesson.CourseId, ct));
        test.Start();

        var attempts = await db.TestResults.CountAsync(r => r.UserId == userId && r.TestId == testId, ct);
        return new TestSessionDto(test.Id, test.Title, lesson.Id, lesson.Title, lesson.CourseId, lesson.Course.Title,
            test.PassingScore, attempts + 1,
            test.Questions.OrderBy(q => q.OrderNumber).Select(q => new QuestionDto(q.Id, q.Text, q.Options)).ToList());
    }

    public async Task<TestResultDto> SubmitAsync(int testId, SubmitAnswersRequest request, CancellationToken ct)
    {
        var userId = currentUser.RequireId();
        if (currentUser.Role != UserRole.Student)
            throw new ForbiddenAccessException("Здавати тести можуть лише студенти. Автор бачить тест у режимі перегляду");

        var test = await LoadTestAsync(testId, ct, tracking: true);
        var lesson = test.Lesson!;
        var enrollment = await learning.GetEnrollmentAsync(userId, lesson.CourseId, ct, tracking: true);
        lesson.Open(enrollment);

        var attempt = await db.TestResults.CountAsync(r => r.UserId == userId && r.TestId == testId, ct) + 1;
        var state = LearningStateMachine.Fire(LearningState.ViewingLesson, LearningTrigger.StartTest);

        var result = TestResult.Evaluate(userId, test, request.Answers, attempt, time.UtcNow());
        db.TestResults.Add(result);
        state = LearningStateMachine.Fire(state,
            result.IsPassed() ? LearningTrigger.ResultAboveThreshold : LearningTrigger.ResultBelowThreshold);

        LessonProgressDto? progress = null;
        if (result.IsPassed() && !enrollment!.IsLessonCompleted(lesson.Id) && await OtherLessonTestsPassedAsync(userId, lesson.Tests, testId, ct))
        {
            await db.SaveChangesAsync(ct);
            progress = await learning.AdvanceAsync(enrollment, lesson, state, result.Id, ct);
            state = progress.NextState;
        }
        else if (result.IsPassed())
        {
            state = LearningState.ViewingLesson;
        }
        else
        {
            notifications.Notify(userId, NotificationType.Test,
                $"Тест «{test.Title}»: {result.Score}% при порозі {test.PassingScore}%. Перегляньте урок і спробуйте ще раз.",
                $"/learn/lessons/{lesson.Id}");
        }
        await db.SaveChangesAsync(ct);

        return ToDto(result, test, enrollment!.Progress, state, progress?.NextLessonId, progress?.CertificateId);
    }

    public async Task<TestResultDto> GetResultAsync(int resultId, CancellationToken ct)
    {
        var userId = currentUser.RequireId();
        var result = await db.TestResults.AsNoTracking()
                         .Include(r => r.Answers).ThenInclude(a => a.Question)
                         .Include(r => r.Test!).ThenInclude(t => t.Questions)
                         .Include(r => r.Test!).ThenInclude(t => t.Lesson!).ThenInclude(l => l.Course)
                         .FirstOrDefaultAsync(r => r.Id == resultId && r.UserId == userId, ct)
                     ?? throw new NotFoundException("Результат не знайдено");

        var courseId = result.Test!.Lesson!.CourseId;
        var progress = await db.Enrollments.Where(e => e.UserId == userId && e.CourseId == courseId)
            .Select(e => e.Progress).FirstOrDefaultAsync(ct);
        var certificateId = await db.Certificates.Where(c => c.UserId == userId && c.CourseId == courseId)
            .Select(c => (int?)c.Id).FirstOrDefaultAsync(ct);
        var nextLessonId = await db.Lessons
            .Where(l => l.CourseId == courseId && l.OrderNumber > result.Test.Lesson.OrderNumber)
            .OrderBy(l => l.OrderNumber).Select(l => (int?)l.Id).FirstOrDefaultAsync(ct);

        var state = certificateId is not null ? LearningState.CertificateGenerated
            : result.Passed ? LearningState.LessonCompleted : LearningState.ViewingLesson;
        return ToDto(result, result.Test, progress, state, nextLessonId, certificateId);
    }

    public async Task<IReadOnlyList<ResultSummaryDto>> GetMyRecentResultsAsync(int take, CancellationToken ct)
    {
        var userId = currentUser.RequireId();
        return await db.TestResults.AsNoTracking()
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.CompletedAt)
            .Take(Math.Clamp(take, 1, 50))
            .Select(r => new ResultSummaryDto(r.Id, r.TestId, r.Test!.Title, r.Test.Lesson!.Course!.Title, r.Score, r.Passed, r.CompletedAt))
            .ToListAsync(ct);
    }

    private async Task<bool> OtherLessonTestsPassedAsync(int userId, IEnumerable<Test> lessonTests, int currentTestId, CancellationToken ct)
    {
        var otherIds = lessonTests.Where(t => t.Id != currentTestId).Select(t => t.Id).ToList();
        if (otherIds.Count == 0) return true;
        var passed = await db.TestResults
            .Where(r => r.UserId == userId && r.Passed && otherIds.Contains(r.TestId))
            .Select(r => r.TestId).Distinct().CountAsync(ct);
        return passed == otherIds.Count;
    }

    private async Task<Test> LoadTestAsync(int testId, CancellationToken ct, bool tracking)
    {
        IQueryable<Test> query = db.Tests
            .Include(t => t.Questions)
            .Include(t => t.Lesson!).ThenInclude(l => l.Tests)
            .Include(t => t.Lesson!).ThenInclude(l => l.Course!).ThenInclude(c => c.Lessons)
            ;
        if (!tracking) query = query.AsNoTrackingWithIdentityResolution();
        return await query.FirstOrDefaultAsync(t => t.Id == testId, ct) ?? throw new NotFoundException("Тест не знайдено");
    }

    private static TestResultDto ToDto(TestResult r, Test test, int progress, LearningState state, int? nextLessonId, int? certificateId)
    {
        var lesson = test.Lesson!;
        return new TestResultDto(
            r.Id, test.Id, test.Title, lesson.Id, lesson.Title, lesson.CourseId, lesson.Course?.Title ?? "",
            r.Score, r.Passed, test.PassingScore, r.AttemptNumber, r.CompletedAt,
            r.Answers.Count(a => a.IsCorrect), test.Questions.Count, progress, state, nextLessonId, certificateId,
            r.Answers.OrderBy(a => a.Question?.OrderNumber).Select(a => new AnswerReviewDto(
                a.QuestionId, a.Question?.Text ?? "", a.SelectedAnswer, a.IsCorrect,
                r.Passed ? a.Question?.CorrectAnswer : null,
                r.Passed ? a.Question?.Explanation : null)).ToList());
    }
}

public sealed class SubmitAnswersRequestValidator : AbstractValidator<SubmitAnswersRequest>
{
    public SubmitAnswersRequestValidator()
    {
        RuleFor(x => x.Answers).NotNull().WithMessage("Надішліть відповіді на питання")
            .Must(a => a.Count <= 200).WithMessage("Забагато відповідей");
    }
}
