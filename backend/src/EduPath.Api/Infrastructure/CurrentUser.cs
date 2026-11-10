using EduPath.Application.Abstractions;
using EduPath.Domain.Users;
using EduPath.Infrastructure.Security;
using Microsoft.AspNetCore.SignalR;

namespace EduPath.Api.Infrastructure;

public sealed class CurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    public int? Id =>
        int.TryParse(accessor.HttpContext?.User.FindFirst(JwtTokenService.SubjectClaim)?.Value, out var id) ? id : null;

    public UserRole? Role =>
        Enum.TryParse<UserRole>(accessor.HttpContext?.User.FindFirst(JwtTokenService.RoleClaim)?.Value, out var role) ? role : null;
}

public sealed class SubjectUserIdProvider : IUserIdProvider
{
    public string? GetUserId(HubConnectionContext connection) => connection.User.FindFirst(JwtTokenService.SubjectClaim)?.Value;
}

public static class Roles
{
    public const string Student = nameof(UserRole.Student);
    public const string Teacher = nameof(UserRole.Teacher);
    public const string Admin = nameof(UserRole.Admin);

    public const string TeacherOrAdmin = Teacher + "," + Admin;
}
