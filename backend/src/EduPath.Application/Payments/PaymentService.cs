using EduPath.Application.Abstractions;
using EduPath.Application.Common;
using EduPath.Application.Learning;
using EduPath.Application.Notifications;
using EduPath.Domain.Common;
using EduPath.Domain.Learning;
using EduPath.Domain.Notifications;
using EduPath.Domain.Payments;
using EduPath.Domain.Users;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace EduPath.Application.Payments;

public sealed record CheckoutRequest(int CourseId, string CardNumber, string CardHolder, string Expiry, string Cvc);

public sealed record PaymentDto(
    int Id,
    int CourseId,
    string CourseTitle,
    decimal Amount,
    string Currency,
    PaymentStatus Status,
    DateTime PaymentDate,
    string? TransactionId,
    string? FailureReason,
    string? CardLast4,
    bool AccessGranted,
    int? FirstLessonId);

public sealed class PaymentService(
    IAppDbContext db,
    ICurrentUser currentUser,
    IPaymentGateway gateway,
    LearningService learning,
    NotificationService notifications,
    TimeProvider time,
    ILogger<PaymentService> logger)
{
    public static readonly TimeSpan AbandonedAfter = TimeSpan.FromMinutes(15);

    public async Task<PaymentDto> CheckoutAsync(CheckoutRequest request, CancellationToken ct)
    {
        var userId = currentUser.RequireId();
        if (currentUser.Role != UserRole.Student) throw new ForbiddenAccessException("Купувати курси можуть лише студенти");

        var course = await learning.LoadCourseAsync(request.CourseId, ct);
        if (!course.IsAvailable()) throw new NotFoundException("Курс не знайдено або ще не опублікований");
        if (course.IsFree) throw new DomainException("Курс безкоштовний: запишіться на нього без оплати");

        var enrollment = await learning.GetEnrollmentAsync(userId, course.Id, ct);
        var lastPayment = await db.Payments
            .Where(p => p.UserId == userId && p.CourseId == course.Id)
            .OrderByDescending(p => p.Id).FirstOrDefaultAsync(ct);
        if (lastPayment is { Status: PaymentStatus.Pending } && time.UtcNow() - lastPayment.PaymentDate > AbandonedAfter)
            lastPayment.Process(false, null, "оплату не було завершено", null, time.UtcNow());

        var state = LearningStateMachine.Resolve(enrollment, lastPayment, hasCertificate: false);
        if (state == LearningState.CourseNotPurchased) state = LearningStateMachine.Fire(state, LearningTrigger.SelectCourse);
        if (state == LearningState.ProcessingPayment)
            throw new ConflictException("Оплата цього курсу вже обробляється. Зачекайте кілька секунд");
        if (!LearningStateMachine.CanFire(state, LearningTrigger.PayForCourse))
            throw new ConflictException("Курс уже придбано — він є у розділі «Мої курси»");
        state = LearningStateMachine.Fire(state, LearningTrigger.PayForCourse);

        var payment = Payment.Create(userId, course, time.UtcNow());
        db.Payments.Add(payment);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            throw new ConflictException("Оплата цього курсу вже обробляється. Зачекайте кілька секунд");
        }

        var response = await ChargeAsync(payment, request, course.Title);
        payment.Process(response.Succeeded, response.TransactionId, response.Error, response.CardLast4, time.UtcNow());

        state = LearningStateMachine.Fire(state, payment.Confirm() ? LearningTrigger.PaymentSuccessful : LearningTrigger.PaymentFailed);
        if (state == LearningState.EnrolledInCourse)
        {
            await learning.EnrollStudentAsync(userId, course, CancellationToken.None);
            notifications.Notify(userId, NotificationType.Payment,
                $"Оплату {payment.Amount:0.##} грн за курс «{course.Title}» підтверджено.", $"/payments/{payment.Id}", sendEmail: true);
        }
        else
        {
            notifications.Notify(userId, NotificationType.Payment,
                $"Оплата курсу «{course.Title}» не пройшла: {payment.FailureReason}. Спробуйте іншу картку.",
                $"/courses/{course.Id}/checkout");
        }
        await db.SaveChangesAsync(CancellationToken.None);

        return ToDto(payment, course.Title, course.OrderedLessons().FirstOrDefault()?.Id);
    }

    private async Task<PaymentGatewayResult> ChargeAsync(Payment payment, CheckoutRequest request, string courseTitle)
    {
        try
        {
            return await gateway.ChargeAsync(new PaymentRequest(
                payment.Amount, payment.Currency, request.CardNumber, request.CardHolder, $"EduPath: {courseTitle}"), CancellationToken.None);
        }
        catch (Exception ex) when (ex is HttpRequestException or TimeoutException or InvalidOperationException)
        {
            logger.LogError(ex, "Платіжний шлюз не обробив платіж {PaymentId}", payment.Id);
            return new PaymentGatewayResult(false, null, "платіжний сервіс тимчасово недоступний", null);
        }
    }

    public async Task<IReadOnlyList<PaymentDto>> GetMineAsync(CancellationToken ct)
    {
        var userId = currentUser.RequireId();
        var payments = await db.Payments.AsNoTracking().Include(p => p.Course)
            .Where(p => p.UserId == userId).OrderByDescending(p => p.Id).ToListAsync(ct);
        return payments.Select(p => ToDto(p, p.Course!.Title, null)).ToList();
    }

    public async Task<PaymentDto> GetAsync(int paymentId, CancellationToken ct)
    {
        var userId = currentUser.RequireId();
        var p = await db.Payments.AsNoTracking().Include(x => x.Course!).ThenInclude(c => c.Lessons)
                    .FirstOrDefaultAsync(x => x.Id == paymentId && x.UserId == userId, ct)
                ?? throw new NotFoundException("Платіж не знайдено");
        return ToDto(p, p.Course!.Title, p.Course.OrderedLessons().FirstOrDefault()?.Id);
    }

    private static PaymentDto ToDto(Payment p, string courseTitle, int? firstLessonId) => new(
        p.Id, p.CourseId, courseTitle, p.Amount, p.Currency, p.Status, p.PaymentDate, p.TransactionId, p.FailureReason,
        p.CardLast4, p.Confirm(), p.Confirm() ? firstLessonId : null);
}

public sealed class CheckoutRequestValidator : AbstractValidator<CheckoutRequest>
{
    public CheckoutRequestValidator()
    {
        RuleFor(x => x.CourseId).GreaterThan(0);
        RuleFor(x => x.CardNumber).NotEmpty().WithMessage("Номер картки має містити від 12 до 19 цифр").Must(n => n.Count(char.IsDigit) is >= 12 and <= 19)
            .WithMessage("Номер картки має містити від 12 до 19 цифр");
        RuleFor(x => x.CardHolder).NotEmpty().WithMessage("Вкажіть ім'я власника картки").MaximumLength(100);
        RuleFor(x => x.Expiry).Cascade(CascadeMode.Stop)
            .Matches(@"^(0[1-9]|1[0-2])/\d{2}$").WithMessage("Термін дії — у форматі ММ/РР")
            .Must(NotExpired).WithMessage("Термін дії картки минув");
        RuleFor(x => x.Cvc).Matches(@"^\d{3,4}$").WithMessage("CVC — три або чотири цифри");
    }

    private static bool NotExpired(string expiry)
    {
        if (expiry.Length != 5 || !int.TryParse(expiry[..2], out var month) || !int.TryParse(expiry[3..], out var year)
            || month is < 1 or > 12) return false;
        var lastDay = new DateTime(2000 + year, month, 1).AddMonths(1);
        return lastDay > DateTime.UtcNow;
    }
}
