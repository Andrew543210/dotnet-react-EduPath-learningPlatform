using EduPath.Domain.Common;

namespace EduPath.Domain.Payments;

public enum PaymentStatus
{
    Pending,
    Succeeded,
    Failed,
}

public class Payment : Entity
{
    public const string DefaultCurrency = "UAH";

    private Payment() { }

    public int UserId { get; private set; }
    public int CourseId { get; private set; }
    public Courses.Course? Course { get; private set; }
    public decimal Amount { get; private set; }
    public string Currency { get; private set; } = DefaultCurrency;
    public PaymentStatus Status { get; private set; } = PaymentStatus.Pending;
    public DateTime PaymentDate { get; private set; }
    public string? TransactionId { get; private set; }
    public string? FailureReason { get; private set; }
    public string? CardLast4 { get; private set; }

    public static Payment Create(int userId, Courses.Course course, DateTime now)
    {
        if (course.IsFree) throw new DomainException("Безкоштовний курс не потребує оплати");
        return new Payment { UserId = userId, CourseId = course.Id, Amount = course.Price, PaymentDate = now };
    }

    public bool Process(bool succeeded, string? transactionId, string? failureReason, string? cardLast4, DateTime now)
    {
        if (Status != PaymentStatus.Pending) throw new DomainException("Платіж уже оброблено");
        Status = succeeded ? PaymentStatus.Succeeded : PaymentStatus.Failed;
        TransactionId = transactionId;
        FailureReason = succeeded ? null : failureReason ?? "Платіж відхилено";
        CardLast4 = cardLast4;
        PaymentDate = now;
        return succeeded;
    }

    public bool Confirm() => Status == PaymentStatus.Succeeded;
}
