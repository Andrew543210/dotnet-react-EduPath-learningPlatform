namespace EduPath.Application.Common;

public class NotFoundException(string message) : Exception(message);

public class ForbiddenAccessException(string message) : Exception(message);

public class ConflictException(string message) : Exception(message);

public class AuthenticationFailedException(string message) : Exception(message);
