using System.Text.Json;
using EduPath.Domain.Assessment;
using EduPath.Domain.Certificates;
using EduPath.Domain.Courses;
using EduPath.Domain.Learning;
using EduPath.Domain.Notifications;
using EduPath.Domain.Payments;
using EduPath.Domain.Reviews;
using EduPath.Domain.Settings;
using EduPath.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace EduPath.Infrastructure.Persistence.Configurations;

internal static class StringListMapping
{
    private static readonly ValueConverter<List<string>, string> Converter = new(
        v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
        v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new List<string>());

    private static readonly ValueComparer<List<string>> Comparer = new(
        (a, b) => (a == null && b == null) || (a != null && b != null && a.SequenceEqual(b)),
        v => v.Aggregate(0, (hash, s) => HashCode.Combine(hash, s.GetHashCode())),
        v => v.ToList());

    public static void MapStringList<T>(this EntityTypeBuilder<T> builder, string field, string column) where T : class =>
        builder.Property<List<string>>(field)
            .HasColumnName(column)
            .HasConversion(Converter, Comparer)
            .UsePropertyAccessMode(PropertyAccessMode.Field)
            .IsRequired();
}

internal sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> b)
    {
        b.Property(u => u.Name).HasMaxLength(User.NameMaxLength);
        b.Property(u => u.Email).HasMaxLength(254);
        b.HasIndex(u => u.Email).IsUnique();
        b.Property(u => u.PasswordHash).HasMaxLength(200);
        b.Property(u => u.Role).HasConversion<string>().HasMaxLength(20);
        b.Property(u => u.Headline).HasMaxLength(120);
        b.Property(u => u.Bio).HasMaxLength(User.BioMaxLength);
    }
}

internal sealed class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> b)
    {
        b.Property(c => c.Name).HasMaxLength(80);
        b.Property(c => c.Slug).HasMaxLength(80);
        b.HasIndex(c => c.Slug).IsUnique();
        b.Property(c => c.Description).HasMaxLength(300);
        b.Property(c => c.Trail).HasConversion<string>().HasMaxLength(10);
    }
}

internal sealed class CourseConfiguration : IEntityTypeConfiguration<Course>
{
    public void Configure(EntityTypeBuilder<Course> b)
    {
        b.Property(c => c.Title).HasMaxLength(Course.TitleMaxLength);
        b.Property(c => c.Summary).HasMaxLength(Course.SummaryMaxLength);
        b.Property(c => c.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(c => c.Level).HasConversion<string>().HasMaxLength(20);
        b.Property(c => c.ModerationComment).HasMaxLength(1000);
        b.Ignore(c => c.Outcomes);
        b.MapStringList("_outcomes", "Outcomes");
        b.HasIndex(c => c.Status);

        b.HasOne(c => c.Category).WithMany(c => c.Courses).HasForeignKey(c => c.CategoryId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(c => c.Teacher).WithMany().HasForeignKey(c => c.TeacherId).OnDelete(DeleteBehavior.Restrict);
        b.HasMany(c => c.Lessons).WithOne(l => l.Course).HasForeignKey(l => l.CourseId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(c => c.Reviews).WithOne().HasForeignKey(r => r.CourseId).OnDelete(DeleteBehavior.Cascade);
        b.Navigation(c => c.Lessons).UsePropertyAccessMode(PropertyAccessMode.Field);
        b.Navigation(c => c.Reviews).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

internal sealed class LessonConfiguration : IEntityTypeConfiguration<Lesson>
{
    public void Configure(EntityTypeBuilder<Lesson> b)
    {
        b.Property(l => l.Title).HasMaxLength(160);
        b.Property(l => l.VideoUrl).HasMaxLength(500);
        b.Property(l => l.MaterialUrl).HasMaxLength(500);
        b.Property(l => l.MaterialName).HasMaxLength(200);
        b.HasIndex(l => new { l.CourseId, l.OrderNumber });
        b.HasMany(l => l.Tests).WithOne(t => t.Lesson).HasForeignKey(t => t.LessonId).OnDelete(DeleteBehavior.Cascade);
        b.Navigation(l => l.Tests).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

internal sealed class TestConfiguration : IEntityTypeConfiguration<Test>
{
    public void Configure(EntityTypeBuilder<Test> b)
    {
        b.Property(t => t.Title).HasMaxLength(160);
        b.HasMany(t => t.Questions).WithOne().HasForeignKey(q => q.TestId).OnDelete(DeleteBehavior.Cascade);
        b.Navigation(t => t.Questions).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

internal sealed class QuestionConfiguration : IEntityTypeConfiguration<Question>
{
    public void Configure(EntityTypeBuilder<Question> b)
    {
        b.Property(q => q.Text).HasMaxLength(1000);
        b.Property(q => q.CorrectAnswer).HasMaxLength(500);
        b.Property(q => q.Explanation).HasMaxLength(1000);
        b.Ignore(q => q.Options);
        b.MapStringList("_options", "Options");
    }
}

internal sealed class TestResultConfiguration : IEntityTypeConfiguration<TestResult>
{
    public void Configure(EntityTypeBuilder<TestResult> b)
    {
        b.HasOne<User>().WithMany().HasForeignKey(r => r.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(r => r.Test).WithMany().HasForeignKey(r => r.TestId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(r => r.Answers).WithOne().HasForeignKey(a => a.TestResultId).OnDelete(DeleteBehavior.Cascade);
        b.Navigation(r => r.Answers).UsePropertyAccessMode(PropertyAccessMode.Field);
        b.HasIndex(r => new { r.UserId, r.TestId });
    }
}

internal sealed class StudentAnswerConfiguration : IEntityTypeConfiguration<StudentAnswer>
{
    public void Configure(EntityTypeBuilder<StudentAnswer> b)
    {
        b.Property(a => a.SelectedAnswer).HasMaxLength(500);
        b.HasOne(a => a.Question).WithMany().HasForeignKey(a => a.QuestionId).OnDelete(DeleteBehavior.NoAction);
    }
}

internal sealed class EnrollmentConfiguration : IEntityTypeConfiguration<Enrollment>
{
    public void Configure(EntityTypeBuilder<Enrollment> b)
    {
        b.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
        b.HasIndex(e => new { e.UserId, e.CourseId }).IsUnique();
        b.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(e => e.Course).WithMany().HasForeignKey(e => e.CourseId).OnDelete(DeleteBehavior.Restrict);
        b.HasMany(e => e.CompletedLessons).WithOne().HasForeignKey(c => c.EnrollmentId).OnDelete(DeleteBehavior.Cascade);
        b.Navigation(e => e.CompletedLessons).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

internal sealed class LessonCompletionConfiguration : IEntityTypeConfiguration<LessonCompletion>
{
    public void Configure(EntityTypeBuilder<LessonCompletion> b)
    {
        b.HasKey(c => c.Id);
        b.HasIndex(c => new { c.EnrollmentId, c.LessonId }).IsUnique();
        b.HasOne<Lesson>().WithMany().HasForeignKey(c => c.LessonId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> b)
    {
        b.Property(p => p.Currency).HasMaxLength(3);
        b.Property(p => p.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(p => p.TransactionId).HasMaxLength(100);
        b.Property(p => p.FailureReason).HasMaxLength(300);
        b.Property(p => p.CardLast4).HasMaxLength(4);
        b.HasOne<User>().WithMany().HasForeignKey(p => p.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(p => p.Course).WithMany().HasForeignKey(p => p.CourseId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(p => new { p.UserId, p.CourseId });
        b.HasIndex(p => new { p.UserId, p.CourseId }, "IX_Payments_PendingPerCourse")
            .IsUnique()
            .HasFilter($"\"Status\" = '{nameof(PaymentStatus.Pending)}'");
    }
}

internal sealed class CertificateConfiguration : IEntityTypeConfiguration<Certificate>
{
    public void Configure(EntityTypeBuilder<Certificate> b)
    {
        b.Property(c => c.Number).HasMaxLength(32);
        b.HasIndex(c => c.Number).IsUnique();
        b.HasIndex(c => new { c.UserId, c.CourseId }).IsUnique();
        b.Property(c => c.FileUrl).HasMaxLength(500);
        b.HasOne(c => c.User).WithMany().HasForeignKey(c => c.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(c => c.Course).WithMany().HasForeignKey(c => c.CourseId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<TestResult>().WithMany().HasForeignKey(c => c.TestResultId).OnDelete(DeleteBehavior.SetNull);
    }
}

internal sealed class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> b)
    {
        b.Property(n => n.Type).HasConversion<string>().HasMaxLength(20);
        b.Property(n => n.Message).HasMaxLength(1000);
        b.Property(n => n.Link).HasMaxLength(300);
        b.HasOne<User>().WithMany().HasForeignKey(n => n.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(n => new { n.UserId, n.IsRead, n.CreatedAt });
    }
}

internal sealed class ReviewConfiguration : IEntityTypeConfiguration<Review>
{
    public void Configure(EntityTypeBuilder<Review> b)
    {
        b.Property(r => r.Comment).HasMaxLength(2000);
        b.HasOne(r => r.User).WithMany().HasForeignKey(r => r.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(r => new { r.CourseId, r.UserId }).IsUnique();
    }
}

internal sealed class SystemSettingsConfiguration : IEntityTypeConfiguration<SystemSettings>
{
    public void Configure(EntityTypeBuilder<SystemSettings> b)
    {
        b.ToTable("Settings");
        b.Property(s => s.Id).ValueGeneratedNever();
        b.Property(s => s.PlatformName).HasMaxLength(60);
        b.Property(s => s.SupportEmail).HasMaxLength(254);
    }
}
