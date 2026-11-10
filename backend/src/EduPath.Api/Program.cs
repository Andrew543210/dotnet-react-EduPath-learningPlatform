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
var signer = app.Services.GetRequiredService<FileUrlSigner>();
Directory.CreateDirectory(storage.RootPath);
app.Use((context, next) =>
{
    var request = context.Request;
    if (!request.Path.StartsWithSegments(storage.PublicPath)
        || signer.Verify(request.Path.Value!, request.Query["expires"], request.Query["signature"]))
        return next(context);

    context.Response.StatusCode = StatusCodes.Status404NotFound;
    return Task.CompletedTask;
});
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(storage.RootPath),
    RequestPath = storage.PublicPath,
    ServeUnknownFileTypes = true,
    DefaultContentType = "application/octet-stream",
    OnPrepareResponse = context =>
    {
        var headers = context.Context.Response.Headers;
        headers.XContentTypeOptions = "nosniff";
        headers.ContentSecurityPolicy = "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'";
    },
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
