using EduPath.Api.Infrastructure;
using EduPath.Api.Realtime;
using EduPath.Application;
using EduPath.Infrastructure;
using EduPath.Infrastructure.External;
using EduPath.Infrastructure.Persistence.Seed;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddApplication()
    .AddInfrastructure(builder.Configuration, builder.Environment)
    .AddApi(builder.Configuration);

var app = builder.Build();

using (var scope = app.Services.CreateScope())
    await scope.ServiceProvider.GetRequiredService<DatabaseInitializer>().InitializeAsync();

app.UseRequestLocalization();
app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference("/docs", o => o.WithTitle("EduPath API"));
}

var storage = app.Services.GetRequiredService<IOptions<StorageOptions>>().Value;
Directory.CreateDirectory(storage.RootPath);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(storage.RootPath),
    RequestPath = storage.PublicPath,
    ServeUnknownFileTypes = true,
    DefaultContentType = "application/octet-stream",
});

var hasSpa = Directory.Exists(app.Environment.WebRootPath);
if (hasSpa) app.UseStaticFiles();

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapControllers();
app.MapHub<NotificationsHub>(NotificationsHub.Path);
app.MapHealthChecks("/health");
if (hasSpa) app.MapFallbackToFile("index.html");

app.Run();

public partial class Program;
