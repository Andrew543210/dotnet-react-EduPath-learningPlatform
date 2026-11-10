using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using EduPath.Application.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace EduPath.IntegrationTests;

public sealed class EduPathFactory : WebApplicationFactory<Program>
{
    public const string Password = "Demo12345";

    private readonly string directory = Path.Combine(Path.GetTempPath(), "edupath-tests-" + Guid.NewGuid().ToString("N")[..8]);

    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        Directory.CreateDirectory(directory);
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Sqlite", $"Data Source={Path.Combine(directory, "edupath.db")}");
        builder.UseSetting("Database:Provider", "Sqlite");
        builder.UseSetting("Database:SeedDemoData", "true");
        builder.UseSetting("Jwt:SigningKey", "integration-tests-signing-key-0123456789-abcdef");
        builder.UseSetting("Payments:SimulatedLatencyMs", "0");
        builder.UseSetting("Storage:RootPath", Path.Combine(directory, "files"));
        builder.UseSetting("RateLimits:AuthPerMinute", "10000");
        builder.UseSetting("RateLimits:PaymentsPerMinute", "10000");
    }

    public async Task<HttpClient> SignInAsync(string email, string? language = null)
    {
        var client = CreateClient();
        if (language is not null) client.DefaultRequestHeaders.AcceptLanguage.Add(new StringWithQualityHeaderValue(language));
        var auth = await client.PostJson<AuthResponse>("/api/auth/login", new LoginRequest(email, Password));
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return client;
    }

    public async Task<(HttpClient Client, UserDto User)> RegisterStudentAsync(string? language = null)
    {
        var client = CreateClient();
        if (language is not null) client.DefaultRequestHeaders.AcceptLanguage.Add(new StringWithQualityHeaderValue(language));
        var email = $"student-{Guid.NewGuid():N}@example.com";
        var auth = await client.PostJson<AuthResponse>("/api/auth/register", new RegisterRequest("Тестовий Студент", email, Password, null));
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return (client, auth.User);
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        try { Directory.Delete(directory, recursive: true); } catch (IOException) { } catch (UnauthorizedAccessException) { }
    }
}

[CollectionDefinition(Name)]
public sealed class ApiCollection : ICollectionFixture<EduPathFactory>
{
    public const string Name = "api";
}

public static class HttpExtensions
{
    public static async Task<T> GetJson<T>(this HttpClient client, string url)
    {
        var response = await client.GetAsync(url);
        await EnsureSuccess(response);
        return (await response.Content.ReadFromJsonAsync<T>(EduPathFactory.Json))!;
    }

    public static async Task<T> PostJson<T>(this HttpClient client, string url, object? body = null)
    {
        var response = await client.PostAsJsonAsync(url, body ?? new { }, EduPathFactory.Json);
        await EnsureSuccess(response);
        return (await response.Content.ReadFromJsonAsync<T>(EduPathFactory.Json))!;
    }

    public static async Task<T> PutJson<T>(this HttpClient client, string url, object body)
    {
        var response = await client.PutAsJsonAsync(url, body, EduPathFactory.Json);
        await EnsureSuccess(response);
        return (await response.Content.ReadFromJsonAsync<T>(EduPathFactory.Json))!;
    }

    public static Task<HttpResponseMessage> Post(this HttpClient client, string url, object? body = null) =>
        client.PostAsJsonAsync(url, body ?? new { }, EduPathFactory.Json);

    public static async Task<JsonElement> Problem(this HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>();

    private static async Task EnsureSuccess(HttpResponseMessage response)
    {
        if (response.StatusCode is >= HttpStatusCode.OK and < HttpStatusCode.MultipleChoices) return;
        throw new HttpRequestException($"{(int)response.StatusCode} {response.RequestMessage?.RequestUri}: {await response.Content.ReadAsStringAsync()}");
    }
}
