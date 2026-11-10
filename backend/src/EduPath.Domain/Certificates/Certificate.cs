using System.Security.Cryptography;
using EduPath.Domain.Common;

namespace EduPath.Domain.Certificates;

public class Certificate : Entity
{
    private const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private Certificate() { }

    public string Number { get; private set; } = "";
    public DateTime IssueDate { get; private set; }
    public int UserId { get; private set; }
    public Users.User? User { get; private set; }
    public int CourseId { get; private set; }
    public Courses.Course? Course { get; private set; }
    public int? TestResultId { get; private set; }
    public int? FinalScore { get; private set; }
    public string? FileUrl { get; private set; }

    public static Certificate Generate(int userId, int courseId, int? finalTestResultId, int? finalScore, DateTime now) => new()
    {
        UserId = userId,
        CourseId = courseId,
        TestResultId = finalTestResultId,
        FinalScore = finalScore is null ? null : Guard.InRange(finalScore.Value, 0, 100, "Бал має бути від 0 до 100"),
        IssueDate = now,
        Number = $"EP-{now:yyyy}-{RandomBlock()}-{RandomBlock()}",
    };

    public void AttachFile(string url) => FileUrl = url;

    private static string RandomBlock() =>
        string.Create(4, 0, (span, _) =>
        {
            for (var i = 0; i < span.Length; i++) span[i] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];
        });
}
