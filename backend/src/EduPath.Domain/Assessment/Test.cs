using EduPath.Domain.Common;
using EduPath.Domain.Courses;

namespace EduPath.Domain.Assessment;

public class Test : Entity
{
    public const int DefaultPassingScore = 70;

    private readonly List<Question> _questions = [];

    private Test() { }

    public int LessonId { get; private set; }
    public Lesson? Lesson { get; private set; }
    public string Title { get; private set; } = "";
    public int PassingScore { get; private set; } = DefaultPassingScore;

    public IReadOnlyCollection<Question> Questions => _questions;

    internal static Test Create(Lesson lesson, string title, int passingScore)
    {
        var test = new Test { Lesson = lesson };
        test.Update(title, passingScore);
        return test;
    }

    public void Update(string title, int passingScore)
    {
        Title = Guard.NotEmpty(title, "Вкажіть назву тесту", 160);
        PassingScore = Guard.InRange(passingScore, 1, 100, "Поріг проходження — від 1 до 100 %");
    }

    public void ReplaceQuestions(IEnumerable<(string Text, IReadOnlyList<string> Options, string CorrectAnswer, string? Explanation)> questions)
    {
        var list = questions.ToList();
        if (list.Count == 0) throw new DomainException("Тест має містити хоча б одне питання");
        _questions.Clear();
        var order = 1;
        foreach (var q in list) _questions.Add(Question.Create(this, order++, q.Text, q.Options, q.CorrectAnswer, q.Explanation));
    }

    public void Start()
    {
        if (_questions.Count == 0) throw new DomainException("У тесті ще немає питань");
    }

    public int CalculateScore(IReadOnlyCollection<StudentAnswer> answers)
    {
        if (_questions.Count == 0) return 0;
        var questionIds = _questions.Select(q => q.Id).ToHashSet();
        var correct = answers.Count(a => a.IsCorrect && questionIds.Contains(a.QuestionId));
        return (int)Math.Round(correct * 100.0 / _questions.Count, MidpointRounding.AwayFromZero);
    }

    public bool IsPassed(int score) => score >= PassingScore;
}
