using EduPath.Api.Infrastructure;
using EduPath.Application.Administration;
using EduPath.Application.Authentication;
using EduPath.Application.Certificates;
using EduPath.Application.Common;
using EduPath.Application.Courses;
using EduPath.Application.Reviews;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace EduPath.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(AuthService auth) : ControllerBase
{
    [HttpPost("register")]
    [EnableRateLimiting(RateLimits.Auth)]
    public Task<AuthResponse> Register(RegisterRequest request, CancellationToken ct) => auth.RegisterAsync(request, ct);

    [HttpPost("login")]
    [EnableRateLimiting(RateLimits.Auth)]
    public Task<AuthResponse> Login(LoginRequest request, CancellationToken ct) => auth.LoginAsync(request, ct);

    [Authorize]
    [HttpGet("me")]
    public Task<UserDto> Me(CancellationToken ct) => auth.GetMeAsync(ct);

    [Authorize]
    [HttpPut("me")]
    public Task<UserDto> UpdateProfile(UpdateProfileRequest request, CancellationToken ct) => auth.UpdateProfileAsync(request, ct);

    [Authorize]
    [HttpPut("me/password")]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request, CancellationToken ct)
    {
        await auth.ChangePasswordAsync(request, ct);
        return NoContent();
    }
}

[ApiController]
[Route("api")]
public sealed class CatalogController(CatalogService catalog, ReviewService reviews, AdminService admin) : ControllerBase
{
    [HttpGet("categories")]
    public Task<IReadOnlyList<CategoryDto>> Categories(CancellationToken ct) => catalog.GetCategoriesAsync(ct);

    [HttpGet("courses")]
    public Task<PagedResult<CourseCardDto>> Search([FromQuery] CourseSearchQuery query, CancellationToken ct) =>
        catalog.SearchAsync(query, ct);

    [HttpGet("courses/{id:int}")]
    public Task<CourseDetailsDto> Course(int id, CancellationToken ct) => catalog.GetCourseAsync(id, ct);

    [HttpGet("courses/{id:int}/reviews")]
    public Task<CourseReviewsDto> Reviews(int id, [FromQuery] int? page, [FromQuery] int? pageSize, CancellationToken ct) =>
        reviews.GetForCourseAsync(id, page, pageSize, ct);

    [HttpGet("teachers/{id:int}")]
    public async Task<TeacherProfileDto> Teacher(int id, CancellationToken ct)
    {
        var (teacher, courses) = await catalog.GetTeacherAsync(id, ct);
        return new TeacherProfileDto(teacher, courses);
    }

    [HttpGet("settings/public")]
    public async Task<PublicSettingsDto> PublicSettings(CancellationToken ct)
    {
        var s = await admin.GetSettingsAsync(ct);
        return new PublicSettingsDto(s.PlatformName, s.SupportEmail, s.AllowTeacherRegistration);
    }

    [HttpGet("certificates/verify/{number}")]
    public Task<CertificateDto> Verify(string number, [FromServices] CertificateService certificates, CancellationToken ct) =>
        certificates.VerifyAsync(number, ct);
}

public sealed record TeacherProfileDto(TeacherDto Teacher, IReadOnlyList<CourseCardDto> Courses);

public sealed record PublicSettingsDto(string PlatformName, string SupportEmail, bool AllowTeacherRegistration);
