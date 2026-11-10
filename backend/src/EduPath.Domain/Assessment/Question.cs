using EduPath.Domain.Common;

namespace EduPath.Domain.Assessment;

public class Question : Entity
{
    private List<string> _options = [];

    private Question() { }

    public int TestId { get; private set; }
    public string Text { get; private set; } = "";
    public string CorrectAnswer { get; private set; } = "";
    public string? Explanation { get; private set; }
    public int OrderNumber { get; private set; }
    public IReadOnlyList<string> Options => _options;

    internal static Question Create(Test test, int order, string text, IReadOnlyList<string> options, string correctAnswer, string? explanation)
    {
        var cleanOptions = options.Select(o => o.Trim()).Where(o => o.Length > 0).Distinct().ToList();
        if (cleanOptions.Count < 2) throw new DomainException($"Питання «{text}» має містити щонайменше два варіанти");
        var correct = Guard.NotEmpty(correctAnswer, "Позначте правильну відповідь");
        if (!cleanOptions.Contains(correct)) throw new DomainException($"Правильна відповідь для «{text}» має бути одним із варіантів");

        return new Question
        {
            TestId = test.Id,
            OrderNumber = order,
            Text = Guard.NotEmpty(text, "Вкажіть текст питання", 500),
            _options = cleanOptions,
            CorrectAnswer = correct,
            Explanation = string.IsNullOrWhiteSpace(explanation) ? null : explanation.Trim(),
        };
    }

    public bool CheckAnswer(string? answer) =>
        answer is not null && string.Equals(answer.Trim(), CorrectAnswer, StringComparison.OrdinalIgnoreCase);
}
