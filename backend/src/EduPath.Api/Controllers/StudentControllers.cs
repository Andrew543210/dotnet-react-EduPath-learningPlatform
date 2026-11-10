using EduPath.Api.Infrastructure;
using EduPath.Api.Localization;
using EduPath.Application.Certificates;
using EduPath.Application.Learning;
using EduPath.Application.Notifications;
using EduPath.Application.Payments;
using EduPath.Application.Reviews;
using EduPath.Application.Testing;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace EduPath.Api.Controllers;

[ApiController]
[Authorize]
[Route("api")]
public sealed class LearningController(LearningService learning) : ControllerBase
{
    [HttpPost("courses/{id:int}/enroll")]
    [Authorize(Roles = Roles.Student)]
    public Task<EnrollmentDto> Enroll(int id, CancellationToken ct) => learning.EnrollFreeAsync(id, ct);

    [HttpGet("me/courses")]
    [Authorize(Roles = Roles.Student)]
    public Task<IReadOnlyList<MyCourseDto>> MyCourses(CancellationToken ct) => learning.GetMyCoursesAsync(ct);

    [HttpGet("lessons/{id:int}")]
    public Task<LessonDto> Lesson(int id, CancellationToken ct) => learning.GetLessonAsync(id, ct);

    [HttpPost("lessons/{id:int}/complete")]
    [Authorize(Roles = Roles.Student)]
    public Task<LessonProgressDto> Complete(int id, CancellationToken ct) => learning.CompleteLessonAsync(id, ct);
}

[ApiController]
[Authorize]
[Route("api")]
public sealed class TestsController(TestingService testing) : ControllerBase
{
    [HttpGet("tests/{id:int}")]
    public Task<TestSessionDto> Get(int id, CancellationToken ct) => testing.GetTestAsync(id, ct);

    [HttpPost("tests/{id:int}/submit")]
    [Authorize(Roles = Roles.Student)]
    public Task<TestResultDto> Submit(int id, SubmitAnswersRequest request, CancellationToken ct) => testing.SubmitAsync(id, request, ct);

    [HttpGet("results/{id:int}")]
    [Authorize(Roles = Roles.Student)]
    public Task<TestResultDto> Result(int id, CancellationToken ct) => testing.GetResultAsync(id, ct);

    [HttpGet("me/results")]
    [Authorize(Roles = Roles.Student)]
    public Task<IReadOnlyList<ResultSummaryDto>> MyResults([FromQuery] int take = 10, CancellationToken ct = default) =>
        testing.GetMyRecentResultsAsync(take, ct);
}

[ApiController]
[Authorize(Roles = Roles.Student)]
[Route("api/payments")]
public sealed class PaymentsController(PaymentService payments, IMessageTranslator translator) : ControllerBase
{
    [HttpPost("checkout")]
    [EnableRateLimiting(RateLimits.Payments)]
    public async Task<PaymentDto> Checkout(CheckoutRequest request, CancellationToken ct) =>
        Translate(await payments.CheckoutAsync(request, ct));

    [HttpGet]
    public async Task<IReadOnlyList<PaymentDto>> Mine(CancellationToken ct) =>
        (await payments.GetMineAsync(ct)).Select(Translate).ToList();

    [HttpGet("{id:int}")]
    public async Task<PaymentDto> Get(int id, CancellationToken ct) => Translate(await payments.GetAsync(id, ct));

    private PaymentDto Translate(PaymentDto p) =>
        p.FailureReason is null ? p : p with { FailureReason = translator.Translate(p.FailureReason) };
}

[ApiController]
[Authorize]
[Route("api/certificates")]
public sealed class CertificatesController(CertificateService certificates) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<CertificateDto>> Mine(CancellationToken ct) => certificates.GetMineAsync(ct);

    [HttpGet("{id:int}")]
    public Task<CertificateDto> Get(int id, CancellationToken ct) => certificates.GetAsync(id, ct);
}

[ApiController]
[Authorize(Roles = Roles.Student)]
[Route("api/courses/{courseId:int}/reviews/mine")]
public sealed class MyReviewController(ReviewService reviews) : ControllerBase
{
    [HttpPut]
    public Task<ReviewDto> Upsert(int courseId, UpsertReviewRequest request, CancellationToken ct) =>
        reviews.UpsertMineAsync(courseId, request, ct);

    [HttpDelete]
    public async Task<IActionResult> Delete(int courseId, CancellationToken ct)
    {
        await reviews.DeleteMineAsync(courseId, ct);
        return NoContent();
    }
}

[ApiController]
[Authorize]
[Route("api/notifications")]
public sealed class NotificationsController(NotificationService notifications, IMessageTranslator translator) : ControllerBase
{
    [HttpGet]
    public async Task<NotificationPageDto> Mine([FromQuery] int? page, [FromQuery] int? pageSize, [FromQuery] bool unreadOnly,
        CancellationToken ct)
    {
        var result = await notifications.GetMineAsync(page, pageSize, unreadOnly, ct);
        return result with { Page = result.Page with { Items = result.Page.Items.Select(Translate).ToList() } };
    }

    [HttpGet("unread-count")]
    public async Task<object> UnreadCount(CancellationToken ct) => new { count = await notifications.CountUnreadAsync(ct) };

    [HttpPost("{id:int}/open")]
    public async Task<NotificationDto> Open(int id, CancellationToken ct) => Translate(await notifications.OpenAsync(id, ct));

    [HttpPost("read-all")]
    public async Task<IActionResult> ReadAll(CancellationToken ct)
    {
        await notifications.MarkAllAsReadAsync(ct);
        return NoContent();
    }

    private NotificationDto Translate(NotificationDto n) => n with { Message = translator.Translate(n.Message) };
}
