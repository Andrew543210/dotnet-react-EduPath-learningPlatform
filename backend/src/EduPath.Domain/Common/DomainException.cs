namespace EduPath.Domain.Common;

public class DomainException(string message) : Exception(message);

public class AccessDeniedException(string message) : DomainException(message);
