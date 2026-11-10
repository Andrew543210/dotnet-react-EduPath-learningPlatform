using EduPath.Application.Abstractions;
using EduPath.Domain.Settings;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EduPath.Infrastructure.Persistence.Seed;

public sealed class DatabaseInitializer(
    AppDbContext db,
    IPasswordHasher hasher,
    IFileStorage storage,
    TimeProvider time,
    IOptions<DatabaseOptions> options,
    ILogger<DatabaseInitializer> logger)
{
    public async Task InitializeAsync(CancellationToken ct = default)
    {
        if (options.Value.MigrateOnStartup) await db.Database.MigrateAsync(ct);

        if (!await db.Settings.AnyAsync(ct))
        {
            db.Settings.Add(new SystemSettings());
            await db.SaveChangesAsync(ct);
        }

        if (options.Value.SeedDemoData && !await db.Users.AnyAsync(ct))
        {
            await new DemoDataSeeder(db, hasher, storage, time.GetUtcNow().UtcDateTime).SeedAsync(ct);
            logger.LogInformation("Демо-дані створено. Пароль для всіх демо-акаунтів: {Password}", DemoDataSeeder.DemoPassword);
        }
    }
}
