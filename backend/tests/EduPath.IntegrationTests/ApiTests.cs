using System.Net;
using EduPath.Api.Controllers;
using EduPath.Application.Administration;
using EduPath.Application.Authentication;
using EduPath.Application.Certificates;
using EduPath.Application.Common;
using EduPath.Application.Courses;
using EduPath.Application.Learning;
using EduPath.Application.Notifications;
using EduPath.Application.Payments;
using EduPath.Application.Reviews;
using EduPath.Application.Teaching;
using EduPath.Application.Testing;
using EduPath.Domain.Courses;
using EduPath.Domain.Learning;
using EduPath.Domain.Payments;
using EduPath.Domain.Users;

namespace EduPath.IntegrationTests;

[Collection(ApiCollection.Name)]
public sealed class CatalogAndAuthTests(EduPathFactory factory)
{
    [Fact]
    public async Task Health_and_catalog_are_public()
    {
        var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health")).StatusCode);

        var page = await client.GetJson<PagedResult<CourseCardDto>>("/api/courses?pageSize=50");
        Assert.True(page.TotalCount >= 8);
        Assert.All(page.Items, c => Assert.Equal(CourseStatus.Published, c.Status));
        Assert.Contains(page.Items, c => c.Title == "Асинхронний C#: async/await без магії");
        Assert.DoesNotContain(page.Items, c => c.Title == "Docker для .NET-розробника");

        var categories = await client.GetJson<List<CategoryDto>>("/api/categories");
        Assert.Equal(4, categories.Count);
        Assert.Equal(page.TotalCount, categories.Sum(c => c.CourseCount));
    }

    [Fact]
    public async Task Search_is_case_insensitive_for_cyrillic_and_filters_combine()
    {
        var client = factory.CreateClient();
        var found = await client.GetJson<PagedResult<CourseCardDto>>("/api/courses?search=" + Uri.EscapeDataString("ТИПОГРАФІКА"));
        Assert.Equal("Типографіка для інтерфейсів", Assert.Single(found.Items).Title);

        var free = await client.GetJson<PagedResult<CourseCardDto>>("/api/courses?price=Free");
        Assert.All(free.Items, c => Assert.Equal(0m, c.Price));

        var cheapFirst = await client.GetJson<PagedResult<CourseCardDto>>("/api/courses?sort=PriceAsc&pageSize=50");
        Assert.Equal(cheapFirst.Items.Select(c => c.Price).Order(), cheapFirst.Items.Select(c => c.Price));
    }

    [Fact]
    public async Task Unpublished_course_is_hidden_from_guests_but_visible_to_author()
    {
        var anonymous = factory.CreateClient();
        var teacher = await factory.SignInAsync("teacher@edupath.dev");
        var draft = (await teacher.GetJson<List<CourseCardDto>>("/api/teach/courses")).First(c => c.Status == CourseStatus.Draft);

        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync($"/api/courses/{draft.Id}")).StatusCode);
        var preview = await teacher.GetJson<CourseDetailsDto>($"/api/courses/{draft.Id}");
        Assert.True(preview.IsPreview);
    }

    [Fact]
    public async Task Register_login_and_profile()
    {
        var (client, user) = await factory.RegisterStudentAsync();
        Assert.Equal(UserRole.Student, user.Role);

        var updated = await client.PutJson<UserDto>("/api/auth/me", new UpdateProfileRequest("Нове Ім'я", "Вчуся SQL", null));
        Assert.Equal("Нове Ім'я", updated.Name);

        var duplicate = await factory.CreateClient().Post("/api/auth/register", new RegisterRequest("Хтось", user.Email, "Password1", null));
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);

        var wrong = await factory.CreateClient().Post("/api/auth/login", new LoginRequest(user.Email, "Wrong12345"));
        Assert.Equal(HttpStatusCode.Unauthorized, wrong.StatusCode);
    }

    [Fact]
    public async Task Validation_errors_are_returned_per_field_in_request_language()
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.AcceptLanguage.ParseAdd("en");
        var response = await client.Post("/api/auth/register", new { name = "", email = "bad", password = "short" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Problem();
        var errors = problem.GetProperty("errors");
        Assert.Equal("Enter your name", errors.GetProperty("name")[0].GetString());
        Assert.Equal("Password must be at least 8 characters long", errors.GetProperty("password")[0].GetString());
    }

    [Fact]
    public async Task Errors_are_localized_by_accept_language()
    {
        var uk = await factory.CreateClient().GetAsync("/api/courses/999999");
        Assert.Equal("Курс не знайдено", (await uk.Problem()).GetProperty("detail").GetString());

        var client = factory.CreateClient();
        client.DefaultRequestHeaders.AcceptLanguage.ParseAdd("en-US,en;q=0.9");
        var en = await client.GetAsync("/api/courses/999999");
        Assert.Equal(HttpStatusCode.NotFound, en.StatusCode);
        Assert.Equal("Course not found", (await en.Problem()).GetProperty("detail").GetString());
    }

    [Theory]
    [InlineData("/api/me/courses", null, HttpStatusCode.Unauthorized)]
    [InlineData("/api/me/courses", "student@edupath.dev", HttpStatusCode.OK)]
    [InlineData("/api/me/courses", "teacher@edupath.dev", HttpStatusCode.Forbidden)]
    [InlineData("/api/teach/overview", "student@edupath.dev", HttpStatusCode.Forbidden)]
    [InlineData("/api/teach/overview", "teacher@edupath.dev", HttpStatusCode.OK)]
    [InlineData("/api/teach/overview", "admin@edupath.dev", HttpStatusCode.OK)]
    [InlineData("/api/admin/overview", "student@edupath.dev", HttpStatusCode.Forbidden)]
    [InlineData("/api/admin/overview", "teacher@edupath.dev", HttpStatusCode.Forbidden)]
    [InlineData("/api/admin/overview", "admin@edupath.dev", HttpStatusCode.OK)]
    [InlineData("/api/admin/users", "admin@edupath.dev", HttpStatusCode.OK)]
    public async Task Each_role_sees_only_its_area(string url, string? email, HttpStatusCode expected)
    {
        var client = email is null ? factory.CreateClient() : await factory.SignInAsync(email);
        Assert.Equal(expected, (await client.GetAsync(url)).StatusCode);
    }

    [Fact]
    public async Task Certificate_can_be_verified_publicly()
    {
        var student = await factory.SignInAsync("student@edupath.dev");
        var certificate = (await student.GetJson<List<CertificateDto>>("/api/certificates")).First();

        var verified = await factory.CreateClient().GetJson<CertificateDto>($"/api/certificates/verify/{certificate.Number.ToLowerInvariant()}");
        Assert.Equal(certificate.Id, verified.Id);
        Assert.Equal("Софія Ткаченко", verified.StudentName);

        var other = (await factory.RegisterStudentAsync()).Client;
        Assert.Equal(HttpStatusCode.Forbidden, (await other.GetAsync($"/api/certificates/{certificate.Id}")).StatusCode);
    }
}

[Collection(ApiCollection.Name)]
public sealed class LearningFlowTests(EduPathFactory factory)
{
    private async Task<Dictionary<int, Dictionary<int, string>>> CorrectAnswersAsync(int courseId)
    {
        var teacher = await factory.SignInAsync("teacher@edupath.dev");
        var editor = await teacher.GetJson<CourseEditorDto>($"/api/teach/courses/{courseId}");
        return editor.Lessons.SelectMany(l => l.Tests)
            .ToDictionary(t => t.Id, t => t.Questions.ToDictionary(q => q.Id, q => q.CorrectAnswer));
    }

    private static async Task<CourseCardDto> FindCourseAsync(HttpClient client, string title) =>
        (await client.GetJson<PagedResult<CourseCardDto>>("/api/courses?pageSize=50")).Items.Single(c => c.Title == title);

    [Fact]
    public async Task Free_course_from_enrollment_to_certificate()
    {
        var (student, _) = await factory.RegisterStudentAsync();
        var course = await FindCourseAsync(student, "Git для командної роботи");
        var answers = await CorrectAnswersAsync(course.Id);

        var lessonBefore = (await student.GetJson<CourseDetailsDto>($"/api/courses/{course.Id}")).Lessons[0];
        Assert.Equal(HttpStatusCode.Forbidden, (await student.GetAsync($"/api/lessons/{lessonBefore.Id}")).StatusCode);

        var enrollment = await student.PostJson<EnrollmentDto>($"/api/courses/{course.Id}/enroll");
        Assert.Equal(EnrollmentStatus.Active, enrollment.Status);

        int? lessonId = lessonBefore.Id;
        LessonProgressDto? last = null;
        while (lessonId is not null)
        {
            var lesson = await student.GetJson<LessonDto>($"/api/lessons/{lessonId}");
            if (lesson.Tests.Count == 0)
            {
                last = await student.PostJson<LessonProgressDto>($"/api/lessons/{lesson.Id}/complete");
                lessonId = last.NextLessonId;
                continue;
            }

            var test = lesson.Tests[0];
            var session = await student.GetJson<TestSessionDto>($"/api/tests/{test.Id}");
            Assert.Equal(answers[test.Id].Count, session.Questions.Count);

            var failed = await student.PostJson<TestResultDto>($"/api/tests/{test.Id}/submit", new SubmitAnswersRequest([]));
            Assert.False(failed.Passed);
            Assert.All(failed.Answers, a => Assert.Null(a.CorrectAnswer));

            var passed = await student.PostJson<TestResultDto>($"/api/tests/{test.Id}/submit", new SubmitAnswersRequest(answers[test.Id]));
            Assert.True(passed.Passed);
            Assert.Equal(100, passed.Score);
            Assert.Equal(2, passed.AttemptNumber);
            Assert.All(passed.Answers, a => Assert.NotNull(a.CorrectAnswer));
            last = new LessonProgressDto(passed.CourseProgress, passed.CertificateId is not null, passed.NextLessonId,
                passed.CertificateId, passed.NextState);
            lessonId = passed.CertificateId is null ? passed.NextLessonId : null;
        }

        Assert.NotNull(last);
        Assert.True(last.CourseCompleted);
        Assert.Equal(LearningState.CertificateGenerated, last.NextState);

        var certificate = await student.GetJson<CertificateDto>($"/api/certificates/{last.CertificateId}");
        Assert.Equal(course.Id, certificate.CourseId);
        Assert.Equal(100, certificate.FinalScore);
        Assert.NotNull(certificate.FileUrl);
        Assert.Equal(HttpStatusCode.OK, (await student.GetAsync(certificate.FileUrl)).StatusCode);

        var mine = Assert.Single(await student.GetJson<List<MyCourseDto>>("/api/me/courses"));
        Assert.Equal(100, mine.Progress);
        Assert.Equal(EnrollmentStatus.Completed, mine.Status);

        var notifications = await student.GetJson<NotificationPageDto>("/api/notifications");
        Assert.Contains(notifications.Page.Items, n => n.Message.Contains(certificate.Number));
        Assert.Equal(HttpStatusCode.NoContent, (await student.Post("/api/notifications/read-all")).StatusCode);
        Assert.Equal(0, (await student.GetJson<NotificationPageDto>("/api/notifications")).UnreadCount);

        var review = await student.PutJson<ReviewDto>($"/api/courses/{course.Id}/reviews/mine", new UpsertReviewRequest(5, "Чудовий курс"));
        Assert.True(review.IsMine);
    }

    [Fact]
    public async Task Paid_course_checkout_follows_payment_sequence()
    {
        var (student, _) = await factory.RegisterStudentAsync(language: "en");
        var course = await FindCourseAsync(student, "A/B-тести без самообману");

        var enrollFree = await student.Post($"/api/courses/{course.Id}/enroll");
        Assert.Equal(HttpStatusCode.UnprocessableEntity, enrollFree.StatusCode);

        var invalid = await student.Post("/api/payments/checkout",
            new CheckoutRequest(course.Id, "1234", "", "13/20", "1"));
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        var errors = (await invalid.Problem()).GetProperty("errors");
        Assert.Equal("Expiry date must be in MM/YY format", errors.GetProperty("expiry")[0].GetString());

        var declined = await student.PostJson<PaymentDto>("/api/payments/checkout",
            new CheckoutRequest(course.Id, "4000 0000 0000 0002", "Test Student", "12/30", "123"));
        Assert.Equal(PaymentStatus.Failed, declined.Status);
        Assert.Equal("the bank declined the card", declined.FailureReason);
        Assert.False(declined.AccessGranted);

        var paid = await student.PostJson<PaymentDto>("/api/payments/checkout",
            new CheckoutRequest(course.Id, "4242 4242 4242 4242", "Test Student", "12/30", "123"));
        Assert.Equal(PaymentStatus.Succeeded, paid.Status);
        Assert.Equal(course.Price, paid.Amount);
        Assert.Equal("4242", paid.CardLast4);
        Assert.True(paid.AccessGranted);
        Assert.NotNull(paid.FirstLessonId);

        var again = await student.Post("/api/payments/checkout",
            new CheckoutRequest(course.Id, "4242 4242 4242 4242", "Test Student", "12/30", "123"));
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);

        var lesson = await student.GetJson<LessonDto>($"/api/lessons/{paid.FirstLessonId}");
        Assert.Equal(course.Id, lesson.CourseId);

        var history = await student.GetJson<List<PaymentDto>>("/api/payments");
        Assert.Equal([PaymentStatus.Succeeded, PaymentStatus.Failed], history.Select(p => p.Status));
    }

    [Fact]
    public async Task Lesson_with_test_cannot_be_completed_manually()
    {
        var (student, _) = await factory.RegisterStudentAsync();
        var course = await FindCourseAsync(student, "Git для командної роботи");
        await student.PostJson<EnrollmentDto>($"/api/courses/{course.Id}/enroll");
        var details = await student.GetJson<CourseDetailsDto>($"/api/courses/{course.Id}");
        var withTest = details.Lessons.First(l => l.HasTest);

        var response = await student.Post($"/api/lessons/{withTest.Id}/complete");
        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
    }
}

[Collection(ApiCollection.Name)]
public sealed class TeachingAndAdminTests(EduPathFactory factory)
{
    [Fact]
    public async Task Teacher_creates_course_admin_moderates_student_sees_it()
    {
        var teacher = await factory.SignInAsync("teacher@edupath.dev");
        var admin = await factory.SignInAsync("admin@edupath.dev");
        var category = (await teacher.GetJson<List<CategoryDto>>("/api/categories")).First(c => c.Slug == "programming");

        var created = await teacher.PostJson<CourseEditorDto>("/api/teach/courses", new UpsertCourseRequest(
            category.Id, "Регулярні вирази на практиці", "Шаблони для валідації та пошуку в тексті.", "Опис", 0m,
            CourseLevel.Beginner, ["Писати регулярні вирази"]));
        Assert.Equal(CourseStatus.Draft, created.Status);

        var submitEmpty = await teacher.Post($"/api/teach/courses/{created.Id}/submit");
        Assert.Equal(HttpStatusCode.UnprocessableEntity, submitEmpty.StatusCode);

        var withLesson = await teacher.PostJson<CourseEditorDto>($"/api/teach/courses/{created.Id}/lessons",
            new UpsertLessonRequest("Символьні класи", "## Класи\n`\\d`, `\\w`, `\\s`", 12, null));
        var lessonId = withLesson.Lessons.Single().Id;
        var withTest = await teacher.PostJson<CourseEditorDto>($"/api/teach/lessons/{lessonId}/tests", new UpsertTestRequest(
            "Класи символів", 70, [new QuestionInput("Що означає \\d?", ["Цифра", "Літера"], "Цифра", null)]));
        Assert.Single(withTest.Lessons.Single().Tests);

        var submitted = await teacher.PostJson<CourseEditorDto>($"/api/teach/courses/{created.Id}/submit");
        Assert.Equal(CourseStatus.PendingReview, submitted.Status);

        var queue = await admin.GetJson<List<ModerationItemDto>>("/api/admin/moderation");
        Assert.Contains(queue, i => i.Course.Id == created.Id);

        var reject = await admin.Post($"/api/admin/moderation/{created.Id}/reject", new ModerationRequest("Додайте ще один урок"));
        Assert.Equal(HttpStatusCode.NoContent, reject.StatusCode);
        var rejected = await teacher.GetJson<CourseEditorDto>($"/api/teach/courses/{created.Id}");
        Assert.Equal(CourseStatus.Rejected, rejected.Status);
        Assert.Equal("Додайте ще один урок", rejected.ModerationComment);

        await teacher.PostJson<CourseEditorDto>($"/api/teach/courses/{created.Id}/submit");
        Assert.Equal(HttpStatusCode.NoContent, (await admin.Post($"/api/admin/moderation/{created.Id}/approve")).StatusCode);

        var (student, _) = await factory.RegisterStudentAsync();
        var details = await student.GetJson<CourseDetailsDto>($"/api/courses/{created.Id}");
        Assert.False(details.IsPreview);
        await student.PostJson<EnrollmentDto>($"/api/courses/{created.Id}/enroll");

        var stats = await teacher.GetJson<CourseStudentsDto>($"/api/teach/courses/{created.Id}/students");
        Assert.Equal(1, stats.Stats.StudentCount);

        var testId = withTest.Lessons.Single().Tests.Single().Id;
        var submit = await student.PostJson<TestResultDto>($"/api/tests/{testId}/submit", new SubmitAnswersRequest(new() { [withTest.Lessons.Single().Tests.Single().Questions.Single().Id] = "Цифра" }));
        Assert.True(submit.Passed);
        Assert.Equal(HttpStatusCode.Conflict, (await teacher.DeleteAsync($"/api/teach/tests/{testId}")).StatusCode);
    }

    [Fact]
    public async Task Teacher_cannot_edit_someone_elses_course()
    {
        var teacher = await factory.SignInAsync("teacher@edupath.dev");
        var foreign = (await factory.CreateClient().GetJson<PagedResult<CourseCardDto>>("/api/courses?pageSize=50"))
            .Items.First(c => c.TeacherName != "Андрій Мельник");
        Assert.Equal(HttpStatusCode.Forbidden, (await teacher.GetAsync($"/api/teach/courses/{foreign.Id}")).StatusCode);
    }

    [Fact]
    public async Task Material_upload_is_served_from_storage()
    {
        var teacher = await factory.SignInAsync("teacher@edupath.dev");
        var course = (await teacher.GetJson<List<CourseCardDto>>("/api/teach/courses")).First(c => c.Status == CourseStatus.Draft);
        var editor = await teacher.GetJson<CourseEditorDto>($"/api/teach/courses/{course.Id}");

        using var form = new MultipartFormDataContent { { new ByteArrayContent("FROM mcr.microsoft.com/dotnet/aspnet:10.0"u8.ToArray()), "file", "Dockerfile.txt" } };
        var response = await teacher.PostAsync($"/api/teach/lessons/{editor.Lessons[0].Id}/material", form);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var updated = await teacher.GetJson<CourseEditorDto>($"/api/teach/courses/{course.Id}");
        var url = updated.Lessons[0].MaterialUrl!;
        Assert.Equal("Dockerfile.txt", updated.Lessons[0].MaterialName);
        Assert.Contains("aspnet:10.0", await factory.CreateClient().GetStringAsync(url));
    }

    [Fact]
    public async Task Admin_manages_users_roles_and_blocking()
    {
        var admin = await factory.SignInAsync("admin@edupath.dev");
        var (_, user) = await factory.RegisterStudentAsync();

        var promoted = await admin.PutJson<UserDto>($"/api/admin/users/{user.Id}/role", new ChangeRoleRequest(UserRole.Teacher));
        Assert.Equal(UserRole.Teacher, promoted.Role);
        var teacherClient = await factory.SignInAsync(user.Email);
        Assert.Equal(HttpStatusCode.OK, (await teacherClient.GetAsync("/api/teach/overview")).StatusCode);

        await admin.PutJson<UserDto>($"/api/admin/users/{user.Id}/block", new BlockUserRequest(true));
        var blocked = await factory.CreateClient().Post("/api/auth/login", new LoginRequest(user.Email, EduPathFactory.Password));
        Assert.Equal(HttpStatusCode.Unauthorized, blocked.StatusCode);

        var self = await admin.GetJson<UserDto>("/api/auth/me");
        var selfBlock = await admin.PutAsync($"/api/admin/users/{self.Id}/block",
            System.Net.Http.Json.JsonContent.Create(new BlockUserRequest(true)));
        Assert.Equal(HttpStatusCode.Forbidden, selfBlock.StatusCode);

        var search = await admin.GetJson<PagedResult<AdminUserDto>>("/api/admin/users?search=" + Uri.EscapeDataString("софія"));
        Assert.Contains(search.Items, u => u.Email == "student@edupath.dev");
    }

    [Fact]
    public async Task Overview_statistics_are_consistent_with_seed()
    {
        var admin = await factory.SignInAsync("admin@edupath.dev");
        var overview = await admin.GetJson<AdminOverviewDto>("/api/admin/overview");

        Assert.Equal(12, overview.RevenueByWeek.Count);
        Assert.True(overview.Revenue > 0);
        Assert.True(overview.Certificates > 0);
        Assert.Equal(1, overview.PendingCourses);

        var settings = await admin.GetJson<SettingsDto>("/api/admin/settings");
        Assert.Equal("EduPath", settings.PlatformName);

        var publicSettings = await factory.CreateClient().GetJson<PublicSettingsDto>("/api/settings/public");
        Assert.True(publicSettings.AllowTeacherRegistration);
    }

    [Fact]
    public async Task Teacher_broadcast_reaches_course_students()
    {
        var teacher = await factory.SignInAsync("teacher@edupath.dev");
        var course = (await teacher.GetJson<List<CourseCardDto>>("/api/teach/courses")).First(c => c.Title.StartsWith("Асинхронний"));
        var sent = await teacher.PostJson<SentDto>($"/api/teach/courses/{course.Id}/notify", new CourseMessageRequest("Додано бонусний урок про IAsyncEnumerable"));
        Assert.True(sent.Recipients > 0);

        var student = await factory.SignInAsync("student@edupath.dev");
        var page = await student.GetJson<NotificationPageDto>("/api/notifications?unreadOnly=true");
        Assert.Contains(page.Page.Items, n => n.Message.Contains("IAsyncEnumerable"));
    }
}
