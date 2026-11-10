using EduPath.Application.Common;
using EduPath.Domain.Users;

namespace EduPath.Application.Abstractions;

public interface ICurrentUser
{
    int? Id { get; }
    UserRole? Role { get; }
}

public static class CurrentUserExtensions
{
    public static int RequireId(this ICurrentUser user) =>
        user.Id ?? throw new AuthenticationFailedException("Увійдіть, щоб продовжити");

    public static bool IsAdmin(this ICurrentUser user) => user.Role == UserRole.Admin;
}
