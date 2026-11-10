using EduPath.Application.Abstractions;
using EduPath.Infrastructure.External;
using EduPath.Infrastructure.Persistence;
using EduPath.Infrastructure.Persistence.Seed;
using EduPath.Infrastructure.Security;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace EduPath.Infrastructure;

public enum DatabaseProvider
{
    Sqlite,
    Postgres,
}

public sealed class DatabaseOptions
{
    public const string Section = "Database";

    public DatabaseProvider Provider { get; set; } = DatabaseProvider.Sqlite;
    public bool MigrateOnStartup { get; set; } = true;
    public bool SeedDemoData { get; set; } = true;
}

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration,
        IHostEnvironment environment)
    {
        var database = configuration.GetSection(DatabaseOptions.Section).Get<DatabaseOptions>() ?? new DatabaseOptions();
        services.Configure<DatabaseOptions>(configuration.GetSection(DatabaseOptions.Section));

        services.AddScoped<IDomainEventDispatcher, DomainEventDispatcher>();
        if (database.Provider == DatabaseProvider.Postgres)
        {
            var connection = configuration.GetConnectionString("Postgres")
                             ?? throw new InvalidOperationException("Не задано ConnectionStrings:Postgres");
            services.AddDbContext<PostgresAppDbContext>(o => o.UseNpgsql(connection,
                npgsql => npgsql.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)));
            services.AddScoped<AppDbContext>(sp => sp.GetRequiredService<PostgresAppDbContext>());
        }
        else
        {
            var connection = ResolveSqlitePath(configuration.GetConnectionString("Sqlite") ?? "Data Source=App_Data/edupath.db",
                environment.ContentRootPath);
            services.AddDbContext<SqliteAppDbContext>(o => o
                .UseSqlite(connection, sqlite => sqlite.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery))
                .AddInterceptors(new SqliteUnicodeFunctionsInterceptor()));
            services.AddScoped<AppDbContext>(sp => sp.GetRequiredService<SqliteAppDbContext>());
        }
        services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());
        services.AddScoped<DatabaseInitializer>();

        services.AddOptions<JwtOptions>().Bind(configuration.GetSection(JwtOptions.Section))
            .Validate(o => o.SigningKey.Length >= 32, "Jwt:SigningKey має містити щонайменше 32 символи")
            .ValidateOnStart();
        services.AddSingleton<ITokenService, JwtTokenService>();
        services.AddSingleton<IPasswordHasher, IdentityPasswordHasher>();

        services.Configure<PaymentGatewayOptions>(configuration.GetSection(PaymentGatewayOptions.Section));
        services.AddSingleton<IPaymentGateway, SandboxPaymentGateway>();

        services.Configure<StorageOptions>(configuration.GetSection(StorageOptions.Section));
        services.PostConfigure<StorageOptions>(o =>
        {
            if (!Path.IsPathRooted(o.RootPath)) o.RootPath = Path.Combine(environment.ContentRootPath, o.RootPath);
        });
        services.AddSingleton<FileUrlSigner>();
        services.AddSingleton<IFileStorage, LocalFileStorage>();
        services.AddSingleton<IEmailSender, LoggingEmailSender>();

        return services;
    }

    private static string ResolveSqlitePath(string connectionString, string contentRoot)
    {
        var builder = new SqliteConnectionStringBuilder(connectionString);
        if (builder.DataSource is not (":memory:" or "") && builder.Mode != SqliteOpenMode.Memory)
        {
            if (!Path.IsPathRooted(builder.DataSource)) builder.DataSource = Path.Combine(contentRoot, builder.DataSource);
            Directory.CreateDirectory(Path.GetDirectoryName(builder.DataSource)!);
        }
        return builder.ToString();
    }
}
