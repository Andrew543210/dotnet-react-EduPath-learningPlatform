using EduPath.Domain.Common;

namespace EduPath.Domain.Assessment;

public class TestResult : Entity
{
    private readonly List<StudentAnswer> _answers = [];

    private TestResult() { }

    public int UserId { get; private set; }
    public int TestId { get; private set; }
    public Test? Test { get; private set; }
    public int Score { get; private set; }
    public bool Passed { get; private set; }
    public DateTime CompletedAt { get; private set; }
    public int AttemptNumber { get; private set; }

    public IReadOnlyCollection<StudentAnswer> Answers => _answers;

    public static TestResult Evaluate(int userId, Test test, IReadOnlyDictionary<int, string> answers, int attemptNumber, DateTime now)
    {
        test.Start();
        if (attemptNumber < 1) throw new DomainException("Номер спроби має бути додатним");

        var result = new TestResult { UserId = userId, TestId = test.Id, Test = test, AttemptNumber = attemptNumber, CompletedAt = now };
        foreach (var question in test.Questions.OrderBy(q => q.OrderNumber))
        {
            var answer = StudentAnswer.For(question, answers.GetValueOrDefault(question.Id));
            answer.Check();
            result._answers.Add(answer);
        }

        result.Score = test.CalculateScore(result._answers);
        result.Passed = test.IsPassed(result.Score);
        return result;
    }

    public bool IsPassed() => Passed;
}

public class StudentAnswer : Entity
{
    private StudentAnswer() { }

    public int TestResultId { get; private set; }
    public int QuestionId { get; private set; }
    public Question? Question { get; private set; }
    public string SelectedAnswer { get; private set; } = "";
    public bool IsCorrect { get; private set; }

    internal static StudentAnswer For(Question question, string? selected) =>
        new() { Question = question, QuestionId = question.Id, SelectedAnswer = selected?.Trim() ?? "" };

    public bool Check()
    {
        IsCorrect = Question?.CheckAnswer(SelectedAnswer) ?? false;
        return IsCorrect;
    }
}
