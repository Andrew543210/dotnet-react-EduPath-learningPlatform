using EduPath.Application.Abstractions;
using EduPath.Application.Administration;
using EduPath.Application.Authentication;
using EduPath.Application.Certificates;
using EduPath.Application.Courses;
using EduPath.Application.Learning;
using EduPath.Application.Notifications;
using EduPath.Application.Payments;
using EduPath.Application.Reviews;
using EduPath.Application.Teaching;
using EduPath.Application.Testing;
using EduPath.Domain.Notifications;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace EduPath.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddSingleton(TimeProvider.System);

        services.AddScoped<AuthService>();
        services.AddScoped<CatalogService>();
        services.AddScoped<LearningService>();
        services.AddScoped<TestingService>();
        services.AddScoped<PaymentService>();
        services.AddScoped<CertificateService>();
        services.AddScoped<NotificationService>();
        services.AddScoped<ReviewService>();
        services.AddScoped<CourseAuthoringService>();
        services.AddScoped<TeachingAnalyticsService>();
        services.AddScoped<AdminService>();

        services.AddScoped<IDomainEventHandler<NotificationCreatedEvent>, NotificationCreatedHandler>();

        services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly, includeInternalTypes: false);
        return services;
    }
}
