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

namespace EduPath.Application.Abstractions;

public interface IAppDbContext
{
    DbSet<User> Users { get; }
    DbSet<Category> Categories { get; }
    DbSet<Course> Courses { get; }
    DbSet<Lesson> Lessons { get; }
    DbSet<Test> Tests { get; }
    DbSet<Question> Questions { get; }
    DbSet<Enrollment> Enrollments { get; }
    DbSet<TestResult> TestResults { get; }
    DbSet<Payment> Payments { get; }
    DbSet<Certificate> Certificates { get; }
    DbSet<Notification> Notifications { get; }
    DbSet<Review> Reviews { get; }
    DbSet<SystemSettings> Settings { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
