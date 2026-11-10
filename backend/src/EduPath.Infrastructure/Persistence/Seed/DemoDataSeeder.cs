using System.Security.Cryptography;
using EduPath.Application.Abstractions;
using EduPath.Domain.Assessment;
using EduPath.Domain.Certificates;
using EduPath.Domain.Courses;
using EduPath.Domain.Learning;
using EduPath.Domain.Notifications;
using EduPath.Domain.Payments;
using EduPath.Domain.Reviews;
using EduPath.Domain.Users;

namespace EduPath.Infrastructure.Persistence.Seed;

internal sealed class DemoDataSeeder(AppDbContext db, IPasswordHasher hasher, IFileStorage storage, DateTime now)
{
    public const string DemoPassword = "Demo12345";

    private readonly Random random = new(2026);
    private readonly Dictionary<string, User> teachers = [];
    private readonly Dictionary<string, Course> courses = [];
    private readonly List<(Enrollment Enrollment, Course Course, DateTime At)> completed = [];
    private readonly Dictionary<string, int> commentCursor = [];

    public async Task SeedAsync(CancellationToken ct)
    {
        var categories = new Dictionary<string, Category>
        {
            ["programming"] = Category.Create("Програмування", "programming", "Мови, інструменти та практики розробки", TrailColor.Blue),
            ["design"] = Category.Create("Дизайн", "design", "Інтерфейси, типографіка та дизайн-системи", TrailColor.Red),
            ["data"] = Category.Create("Аналітика даних", "data", "SQL, експерименти й робота з метриками", TrailColor.Green),
            ["marketing"] = Category.Create("Маркетинг", "marketing", "Розсилки, контент і просування", TrailColor.Yellow),
        };
        db.Categories.AddRange(categories.Values);

        var hash = hasher.Hash(DemoPassword);
        var admin = AddUser("Олена Коваль", "admin@edupath.dev", UserRole.Admin, 170, hash, "Адміністраторка платформи");
        teachers["andrii"] = AddUser("Андрій Мельник", "teacher@edupath.dev", UserRole.Teacher, 150, hash,
            "Senior .NET-розробник, 9 років у продуктових командах",
            "Пишу бекенд для фінтеху й освітніх продуктів. Викладаю те, що сам хотів би знати на початку: без зайвої теорії, з кодом, який можна запустити.");
        teachers["iryna"] = AddUser("Ірина Бондар", "iryna.bondar@edupath.dev", UserRole.Teacher, 140, hash,
            "Продуктова дизайнерка, викладає типографіку з 2019 року",
            "Проєктую інтерфейси для банків і медіа. Вірю, що хороша типографіка — це насамперед повага до читача.");
        teachers["taras"] = AddUser("Тарас Гнатюк", "taras.hnatiuk@edupath.dev", UserRole.Teacher, 135, hash,
            "Аналітик даних у фінтеху",
            "Шість років будую дашборди й експерименти. Допомагаю продуктовим командам відповідати на питання цифрами.");
        teachers["marta"] = AddUser("Марта Лисенко", "marta.lysenko@edupath.dev", UserRole.Teacher, 128, hash,
            "Маркетологиня, веде розсилки для локального бізнесу");

        var sofia = AddUser("Софія Ткаченко", "student@edupath.dev", UserRole.Student, 60, hash,
            "Junior-розробниця, вчуся бекенду", "Перейшла в ІТ з журналістики. Цікавлюся .NET і дизайном інтерфейсів.");
        string[] names =
        [
            "Максим Савчук", "Анна Кравець", "Дмитро Олійник", "Юлія Шевчук", "Богдан Поліщук", "Катерина Мороз",
            "Олег Руденко", "Вікторія Павленко", "Назар Бойко", "Діана Захарченко", "Роман Кузьменко", "Христина Петренко",
            "Артем Литвиненко", "Оксана Гончар", "Іван Марченко", "Леся Ковальчук", "Тимофій Ярошенко", "Мирослава Дяченко",
            "Олександр Ткачук", "Соломія Білик", "Євген Онищенко", "Аліна Сидоренко", "Василь Головко", "Марія Прокопенко",
        ];
        string[] emails =
        [
            "maksym.savchuk", "anna.kravets", "dmytro.oliinyk", "yuliia.shevchuk", "bohdan.polishchuk", "kateryna.moroz",
            "oleh.rudenko", "viktoriia.pavlenko", "nazar.boiko", "diana.zakharchenko", "roman.kuzmenko", "khrystyna.petrenko",
            "artem.lytvynenko", "oksana.honchar", "ivan.marchenko", "lesia.kovalchuk", "tymofii.yaroshenko", "myroslava.diachenko",
            "oleksandr.tkachuk", "solomiia.bilyk", "yevhen.onyshchenko", "alina.sydorenko", "vasyl.holovko", "mariia.prokopenko",
        ];
        var students = names.Select((name, i) =>
            AddUser(name, $"{emails[i]}@example.com", UserRole.Student, 6 + (i * 37 % 82), hash)).ToList();
        await db.SaveChangesAsync(ct);

        foreach (var seed in DemoCatalog.Courses) courses[seed.Key] = AddCourse(seed, categories[seed.Category]);
        await db.SaveChangesAsync(ct);
        await AttachCheatSheetAsync(ct);

        Enroll(sofia, courses["git"], now.AddDays(-44), lessons: 5, skill: 0.9);
        Enroll(sofia, courses["async"], now.AddDays(-21), lessons: 3, skill: 0.75);
        Enroll(sofia, courses["typography"], now.AddDays(-5), lessons: 1, skill: 0.9, declineFirst: "на картці недостатньо коштів");

        var published = courses.Values.Where(c => c.Status == CourseStatus.Published).ToList();
        foreach (var student in students)
        {
            var picks = published.OrderBy(_ => random.Next()).Take(random.Next(2, 5)).ToList();
            foreach (var course in picks)
            {
                var earliest = Max(student.CreatedAt, course.PublishedAt!.Value).AddHours(2);
                var span = Math.Max(1, (now.AddDays(-2) - earliest).TotalHours);
                var at = earliest.AddHours(random.NextDouble() * Math.Min(span, 24 * 24));
                var total = course.Lessons.Count;
                var lessons = random.NextDouble() < 0.35 ? total : random.Next(0, total);
                Enroll(student, course, at, lessons, skill: 0.6 + random.NextDouble() * 0.35,
                    declineFirst: random.NextDouble() < 0.12 ? "банк відхилив картку" : null);
            }
        }
        await db.SaveChangesAsync(ct);

        await IssueCertificatesAsync(ct);
        AddNotifications(admin, sofia);
        await db.SaveChangesAsync(ct);
    }

    private User AddUser(string name, string email, UserRole role, int daysAgo, string hash, string? headline = null, string? bio = null)
    {
        var user = User.Register(name, email, hash, role);
        if (headline is not null || bio is not null) user.UpdateProfile(name, headline, bio);
        var created = now.AddDays(-daysAgo).AddMinutes(-random.Next(0, 600));
        user.CreatedAt = created;
        user.UpdatedAt = created;
        user.RecordLogin(Min(now.AddHours(-random.Next(1, 72)), now));
        db.Users.Add(user);
        return user;
    }

    private Course AddCourse(CourseSeed seed, Category category)
    {
        var teacher = teachers[seed.Teacher];
        var course = Course.Create(teacher.Id, category.Id, seed.Title, seed.Summary, seed.Description.Trim(), seed.Price, seed.Level, seed.Outcomes);
        foreach (var (lessonSeed, index) in seed.Lessons.Select((l, i) => (l, i)))
        {
            var lesson = course.AddLesson(lessonSeed.Title, SeedContent.Lesson(seed.Key, index + 1), lessonSeed.Minutes);
            if (lessonSeed.Test is { } t)
                lesson.AddTest(t.Title, t.PassingScore)
                    .ReplaceQuestions(t.Questions.Select(q => (q.Text, (IReadOnlyList<string>)q.Options, q.Correct, q.Explanation)));
        }

        var publishedAt = now.AddDays(-seed.PublishedDaysAgo);
        course.CreatedAt = publishedAt.AddDays(-12);
        course.UpdatedAt = publishedAt;
        switch (seed.State)
        {
            case SeedState.Published:
                course.SubmitForReview(moderationRequired: false, publishedAt);
                break;
            case SeedState.PendingReview:
                course.SubmitForReview(moderationRequired: true, now.AddDays(-2));
                course.UpdatedAt = now.AddDays(-2);
                break;
            case SeedState.Rejected:
                course.SubmitForReview(moderationRequired: true, now.AddDays(-9));
                course.Reject(seed.ModerationComment ?? "Потрібне доопрацювання");
                course.UpdatedAt = now.AddDays(-8);
                break;
            case SeedState.Draft:
                course.UpdatedAt = now.AddDays(-1);
                break;
        }
        db.Courses.Add(course);
        return course;
    }

    private async Task AttachCheatSheetAsync(CancellationToken ct)
    {
        var lesson = courses["async"].OrderedLessons().ElementAt(3);
        await using var stream = SeedContent.Open("materials/cancellation-cheatsheet.md");
        lesson.AttachMaterial(await storage.SaveAsync($"courses/{lesson.CourseId}", "cancellation-cheatsheet.md", stream, ct),
            "cancellation-cheatsheet.md");
    }

    private void Enroll(User student, Course course, DateTime at, int lessons, double skill, string? declineFirst = null)
    {
        if (!course.IsFree)
        {
            if (declineFirst is not null)
            {
                var failed = Payment.Create(student.Id, course, at.AddMinutes(-6));
                failed.Process(false, null, declineFirst, "0002", at.AddMinutes(-6));
                db.Payments.Add(failed);
            }
            var payment = Payment.Create(student.Id, course, at);
            payment.Process(true, "pi_" + Convert.ToHexString(RandomNumberGenerator.GetBytes(12)).ToLowerInvariant(), null,
                random.Next(1000, 9999).ToString(), at);
            db.Payments.Add(payment);
        }

        var enrollment = Enrollment.Create(student.Id, course.Id, at);
        enrollment.Activate(at);
        db.Enrollments.Add(enrollment);

        var lessonIds = course.Lessons.Select(l => l.Id).ToList();
        var t = at;
        foreach (var lesson in course.OrderedLessons().Take(lessons))
        {
            t = Min(t.AddHours(4 + random.NextDouble() * 60), now.AddMinutes(-40));
            foreach (var test in lesson.Tests)
            {
                for (var attempt = 1; ; attempt++)
                {
                    var answers = test.Questions.ToDictionary(q => q.Id, q => Answer(q, attempt >= 3 ? 1 : skill));
                    var result = TestResult.Evaluate(student.Id, test, answers, attempt, t);
                    db.TestResults.Add(result);
                    if (result.Passed) break;
                    t = Min(t.AddHours(1 + random.NextDouble() * 5), now.AddMinutes(-30));
                }
            }
            lesson.MarkCompleted(enrollment, t);
            enrollment.RecalculateProgress(lessonIds, t);
        }

        if (enrollment.Status == EnrollmentStatus.Completed) completed.Add((enrollment, course, t));
        if (enrollment.Progress >= 40 && random.NextDouble() < 0.7) AddReview(student, course, Min(t.AddHours(random.Next(1, 30)), now.AddMinutes(-20)));
    }

    private string Answer(Question question, double skill)
    {
        if (random.NextDouble() < skill) return question.CorrectAnswer;
        var wrong = question.Options.Where(o => o != question.CorrectAnswer).ToList();
        return wrong[random.Next(wrong.Count)];
    }

    private void AddReview(User student, Course course, DateTime at)
    {
        var key = courses.First(c => c.Value == course).Key;
        if (!DemoCatalog.ReviewComments.TryGetValue(key, out var pool)) return;
        var index = commentCursor.GetValueOrDefault(key);
        commentCursor[key] = index + 1;

        var roll = random.NextDouble();
        var rating = roll < 0.52 ? 5 : roll < 0.86 ? 4 : roll < 0.97 ? 3 : 2;
        var review = Review.Create(course.Id, student.Id, rating, pool[index % pool.Length]);
        review.CreatedAt = at;
        review.UpdatedAt = at;
        db.Reviews.Add(review);
    }

    private async Task IssueCertificatesAsync(CancellationToken ct)
    {
        foreach (var (enrollment, course, at) in completed)
        {
            var tests = course.Lessons.SelectMany(l => l.Tests).Select(t => t.Id).ToHashSet();
            var results = db.TestResults.Local.Where(r => r.UserId == enrollment.UserId && tests.Contains(r.TestId)).ToList();
            var best = results.GroupBy(r => r.TestId).Select(g => g.Max(r => r.Score)).ToList();
            var final = results.Where(r => r.Passed).MaxBy(r => r.CompletedAt);
            db.Certificates.Add(Certificate.Generate(enrollment.UserId, course.Id, final?.Id,
                best.Count == 0 ? null : (int)Math.Round(best.Average()), at));
        }
        await db.SaveChangesAsync(ct);
    }

    private void AddNotifications(User admin, User sofia)
    {
        var async = courses["async"];
        var typography = courses["typography"];
        var git = courses["git"];
        var gitCertificate = db.Certificates.Local.First(c => c.UserId == sofia.Id && c.CourseId == git.Id);
        var asyncLesson = async.OrderedLessons().ElementAt(2);

        Notify(sofia, NotificationType.General, "Вітаємо на EduPath! Оберіть перший курс у каталозі.", "/catalog", 60, read: true);
        Notify(sofia, NotificationType.Certificate,
            $"Курс «{git.Title}» завершено. Сертифікат {gitCertificate.Number} уже у вашому профілі.", "/certificates", 30, read: true);
        Notify(sofia, NotificationType.Payment, $"Оплату {async.Price:0.##} грн за курс «{async.Title}» підтверджено.", "/payments", 21, read: true);
        Notify(sofia, NotificationType.Payment,
            $"Оплата курсу «{typography.Title}» не пройшла: на картці недостатньо коштів. Спробуйте іншу картку.",
            $"/courses/{typography.Id}/checkout", 5, read: true);
        Notify(sofia, NotificationType.Payment, $"Оплату {typography.Price:0.##} грн за курс «{typography.Title}» підтверджено.", "/payments", 5);
        Notify(sofia, NotificationType.Course,
            $"Урок «{asyncLesson.Title}» зараховано. Прогрес курсу: 50%.", $"/learn/lessons/{async.OrderedLessons().ElementAt(3).Id}", 2);
        Notify(sofia, NotificationType.Announcement,
            "Оновили сторінку уроку: зміст курсу тепер завжди під рукою, а матеріали можна завантажити одним кліком.", null, 1);

        foreach (var (course, days) in new[] { (async, 3), (courses["typescript"], 6), (git, 9) })
            Notify(teachers["andrii"], NotificationType.Course, $"Новий студент на курсі «{course.Title}»",
                $"/teach/courses/{course.Id}/students", days, read: days > 5);

        var pending = courses["b2b-content"];
        Notify(admin, NotificationType.Moderation, $"Новий курс на перевірці: «{pending.Title}»", "/admin/moderation", 2);
        var rejected = courses["palettes"];
        Notify(teachers["iryna"], NotificationType.Moderation,
            $"Курс «{rejected.Title}» повернуто на доопрацювання: {rejected.ModerationComment}", $"/teach/courses/{rejected.Id}", 8);
    }

    private void Notify(User user, NotificationType type, string message, string? link, int daysAgo, bool read = false)
    {
        var n = Notification.Create(user.Id, type, message, link, now.AddDays(-daysAgo).AddMinutes(-random.Next(0, 300)));
        if (read) n.MarkAsRead();
        db.Notifications.Add(n);
    }

    private static DateTime Min(DateTime a, DateTime b) => a < b ? a : b;

    private static DateTime Max(DateTime a, DateTime b) => a > b ? a : b;
}
