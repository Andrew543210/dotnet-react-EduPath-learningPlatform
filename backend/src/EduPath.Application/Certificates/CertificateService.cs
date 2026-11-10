using System.Net;
using System.Text;
using EduPath.Application.Abstractions;
using EduPath.Application.Common;
using EduPath.Application.Notifications;
using EduPath.Domain.Certificates;
using EduPath.Domain.Courses;
using EduPath.Domain.Notifications;
using Microsoft.EntityFrameworkCore;

namespace EduPath.Application.Certificates;

public sealed record CertificateDto(
    int Id,
    string Number,
    DateTime IssueDate,
    int CourseId,
    string CourseTitle,
    TrailColor Trail,
    string StudentName,
    string TeacherName,
    int? FinalScore,
    int LessonCount,
    int DurationMinutes,
    string? FileUrl);

public sealed class CertificateService(
    IAppDbContext db,
    IFileStorage storage,
    ICurrentUser currentUser,
    NotificationService notifications,
    TimeProvider time)
{
    public async Task<Certificate> GenerateAsync(int userId, Course course, int? finalTestResultId, CancellationToken ct)
    {
        var existing = await db.Certificates.FirstOrDefaultAsync(c => c.UserId == userId && c.CourseId == course.Id, ct);
        if (existing is not null) return existing;

        var testIds = await db.Tests.Where(t => t.Lesson!.CourseId == course.Id).Select(t => t.Id).ToListAsync(ct);
        var bestScores = await db.TestResults
            .Where(r => r.UserId == userId && testIds.Contains(r.TestId))
            .GroupBy(r => r.TestId)
            .Select(g => g.Max(r => r.Score))
            .ToListAsync(ct);
        int? finalScore = bestScores.Count == 0 ? null : (int)Math.Round(bestScores.Average());

        var certificate = Certificate.Generate(userId, course.Id, finalTestResultId, finalScore, time.UtcNow());
        var studentName = await db.Users.Where(u => u.Id == userId).Select(u => u.Name).FirstAsync(ct);
        var teacherName = await db.Users.Where(u => u.Id == course.TeacherId).Select(u => u.Name).FirstAsync(ct);

        var html = RenderHtml(certificate, studentName, course.Title, teacherName);
        await using (var stream = new MemoryStream(Encoding.UTF8.GetBytes(html)))
            certificate.AttachFile(await storage.SaveAsync("certificates", $"{certificate.Number}.html", stream, ct));

        db.Certificates.Add(certificate);
        await db.SaveChangesAsync(ct);

        notifications.Notify(userId, NotificationType.Certificate,
            $"Курс «{course.Title}» завершено. Сертифікат {certificate.Number} уже у вашому профілі.",
            $"/certificates/{certificate.Id}", sendEmail: true);
        await db.SaveChangesAsync(ct);
        return certificate;
    }

    public async Task<IReadOnlyList<CertificateDto>> GetMineAsync(CancellationToken ct)
    {
        var userId = currentUser.RequireId();
        return await Project(db.Certificates.Where(c => c.UserId == userId).OrderByDescending(c => c.IssueDate)).ToListAsync(ct);
    }

    public async Task<CertificateDto> GetAsync(int certificateId, CancellationToken ct)
    {
        var userId = currentUser.RequireId();
        var access = await db.Certificates.Where(c => c.Id == certificateId)
                         .Select(c => new { c.UserId, c.Course!.TeacherId }).FirstOrDefaultAsync(ct)
                     ?? throw new NotFoundException("Сертифікат не знайдено");
        if (access.UserId != userId && access.TeacherId != userId && !currentUser.IsAdmin())
            throw new ForbiddenAccessException("Цей сертифікат належить іншому користувачу");
        return await Project(db.Certificates.Where(c => c.Id == certificateId)).FirstAsync(ct);
    }

    public async Task<CertificateDto> VerifyAsync(string number, CancellationToken ct) =>
        await Project(db.Certificates.Where(c => c.Number == number.Trim().ToUpperInvariant())).FirstOrDefaultAsync(ct)
        ?? throw new NotFoundException("Сертифіката з таким номером не існує");

    private static IQueryable<CertificateDto> Project(IQueryable<Certificate> query) =>
        query.AsNoTracking().Select(c => new CertificateDto(
            c.Id, c.Number, c.IssueDate, c.CourseId, c.Course!.Title, c.Course.Category!.Trail, c.User!.Name,
            c.Course.Teacher!.Name, c.FinalScore, c.Course.Lessons.Count, c.Course.Lessons.Sum(l => l.DurationMinutes), c.FileUrl));

    private static string RenderHtml(Certificate c, string student, string course, string teacher)
    {
        static string E(string s) => WebUtility.HtmlEncode(s);
        return $$"""
            <!doctype html>
            <html lang="uk"><head><meta charset="utf-8"><title>Сертифікат {{E(c.Number)}}</title>
            <style>
              body{margin:0;background:#eef0eb;font-family:Georgia,serif;color:#1c2b26;display:grid;place-items:center;min-height:100vh}
              .c{background:#fff;width:760px;padding:56px 64px;border-left:14px solid #1c2b26}
              .mark{display:flex;gap:0;width:54px;height:18px;margin-bottom:28px}.mark i{flex:1}
              h1{font-size:34px;margin:8px 0 4px;font-weight:600}.m{color:#5e6b66}
              .f{display:flex;justify-content:space-between;margin-top:48px;font-size:14px}
            </style></head>
            <body><div class="c">
              <div class="mark"><i style="background:#fff;border:1px solid #ccc"></i><i style="background:#d3302b"></i><i style="background:#fff;border:1px solid #ccc"></i></div>
              <div class="m">EduPath засвідчує, що</div>
              <h1>{{E(student)}}</h1>
              <div class="m">завершив(-ла) курс</div>
              <h2>{{E(course)}}</h2>
              <div class="f"><span>Викладач: {{E(teacher)}}</span><span>{{c.IssueDate:dd.MM.yyyy}}</span><span>{{E(c.Number)}}</span></div>
            </div></body></html>
            """;
    }
}
