using System.Globalization;
using System.Security.Claims;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using EduPath.Api.Controllers;
using EduPath.Api.Localization;
using EduPath.Api.Realtime;
using EduPath.Application.Abstractions;
using EduPath.Infrastructure.Persistence;
using EduPath.Infrastructure.Security;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Localization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace EduPath.Api.Infrastructure;

public static class RateLimits
{
    public const string Auth = "auth";
    public const string Payments = "payments";
}

public static class ApiServices
{
    public static IServiceCollection AddApi(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUser, CurrentUser>();
        services.AddSingleton<IMessageTranslator, MessageTranslator>();
        services.AddValidatorsFromAssemblyContaining<CourseMessageRequestValidator>();

        services.AddControllers(o => o.Filters.Add<ValidationFilter>())
            .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
        services.AddProblemDetails();
        services.AddExceptionHandler<ProblemExceptionHandler>();
        services.AddOpenApi();

        services.AddRequestLocalization(o =>
        {
            var cultures = MessageTranslator.SupportedCultures.Select(c => new CultureInfo(c)).ToList();
            o.DefaultRequestCulture = new RequestCulture("uk");
            o.SupportedCultures = cultures;
            o.SupportedUICultures = cultures;
            o.RequestCultureProviders = [new QueryStringRequestCultureProvider { QueryStringKey = "lang", UIQueryStringKey = "lang" },
                new AcceptLanguageHeaderRequestCultureProvider()];
        });

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
        services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
            .Configure<IOptions<JwtOptions>>((o, jwt) =>
            {
                o.MapInboundClaims = false;
                o.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidIssuer = jwt.Value.Issuer,
                    ValidAudience = jwt.Value.Audience,
                    IssuerSigningKey = jwt.Value.Key(),
                    NameClaimType = JwtTokenService.NameClaim,
                    RoleClaimType = JwtTokenService.RoleClaim,
                    ClockSkew = TimeSpan.FromMinutes(1),
                };
                o.Events = new JwtBearerEvents
                {
                    OnMessageReceived = context =>
                    {
                        var token = context.Request.Query["access_token"];
                        if (!string.IsNullOrEmpty(token) && context.HttpContext.Request.Path.StartsWithSegments(NotificationsHub.Path))
                            context.Token = token;
                        return Task.CompletedTask;
                    },
                    OnTokenValidated = RejectInactiveAccountsAsync,
                };
            });
        services.AddAuthorization();

        services.AddSignalR().AddJsonProtocol(o => o.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
        services.AddSingleton<IUserIdProvider, SubjectUserIdProvider>();
        services.AddSingleton<IRealtimeNotifier, SignalRNotifier>();

        services.AddRateLimiter(o =>
        {
            o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            o.AddPolicy(RateLimits.Auth, http => RateLimitPartition.GetFixedWindowLimiter(
                http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = configuration.GetValue("RateLimits:AuthPerMinute", 20), Window = TimeSpan.FromMinutes(1) }));
            o.AddPolicy(RateLimits.Payments, http => RateLimitPartition.GetFixedWindowLimiter(
                http.User.FindFirst(JwtTokenService.SubjectClaim)?.Value ?? "anonymous",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = configuration.GetValue("RateLimits:PaymentsPerMinute", 10), Window = TimeSpan.FromMinutes(1) }));
        });

        var origins = configuration.GetSection("Cors:Origins").Get<string[]>() ?? [];
        services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));

        services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database");
        return services;
    }

    private static async Task RejectInactiveAccountsAsync(TokenValidatedContext context)
    {
        var principal = context.Principal!;
        if (!int.TryParse(principal.FindFirstValue(JwtTokenService.SubjectClaim), out var userId))
        {
            context.Fail("The token has no valid subject");
            return;
        }

        var db = context.HttpContext.RequestServices.GetRequiredService<IAppDbContext>();
        var account = await db.Users.AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new { u.Role, u.IsBlocked })
            .FirstOrDefaultAsync(context.HttpContext.RequestAborted);

        if (account is null || account.IsBlocked || account.Role.ToString() != principal.FindFirstValue(JwtTokenService.RoleClaim))
            context.Fail("The account is blocked, removed or its role has changed");
    }
}

public sealed class DatabaseHealthCheck(AppDbContext db) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken ct = default) =>
        await db.Database.CanConnectAsync(ct) ? HealthCheckResult.Healthy() : HealthCheckResult.Unhealthy("База даних недоступна");
}

public sealed class CourseMessageRequestValidator : AbstractValidator<CourseMessageRequest>
{
    public CourseMessageRequestValidator() =>
        RuleFor(x => x.Message).NotEmpty().WithMessage("Напишіть текст сповіщення").MaximumLength(500);
}
