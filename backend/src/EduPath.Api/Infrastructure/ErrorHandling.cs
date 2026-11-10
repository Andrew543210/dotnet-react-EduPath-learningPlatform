using EduPath.Api.Localization;
using EduPath.Application.Common;
using EduPath.Domain.Common;
using FluentValidation;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace EduPath.Api.Infrastructure;

public sealed class ProblemExceptionHandler(
    IProblemDetailsService problems,
    IMessageTranslator translator,
    ILogger<ProblemExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        if (exception is OperationCanceledException && context.RequestAborted.IsCancellationRequested) return true;

        var (status, code) = exception switch
        {
            NotFoundException => (StatusCodes.Status404NotFound, "not_found"),
            ForbiddenAccessException or AccessDeniedException => (StatusCodes.Status403Forbidden, "forbidden"),
            AuthenticationFailedException => (StatusCodes.Status401Unauthorized, "unauthorized"),
            ConflictException => (StatusCodes.Status409Conflict, "conflict"),
            DomainException => (StatusCodes.Status422UnprocessableEntity, "business_rule"),
            _ => (StatusCodes.Status500InternalServerError, "server_error"),
        };

        if (status == StatusCodes.Status500InternalServerError) logger.LogError(exception, "Необроблена помилка");

        var detail = status == StatusCodes.Status500InternalServerError
            ? translator.Translate("Сталася непередбачена помилка. Спробуйте ще раз за хвилину")
            : translator.Translate(exception.Message);

        context.Response.StatusCode = status;
        return await problems.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = context,
            Exception = exception,
            ProblemDetails = new ProblemDetails
            {
                Status = status,
                Title = detail,
                Detail = detail,
                Extensions = { ["code"] = code },
            },
        });
    }
}

public sealed class ValidationFilter(IServiceProvider services, IMessageTranslator translator) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        foreach (var argument in context.ActionArguments.Values)
        {
            if (argument is null) continue;
            if (services.GetService(typeof(IValidator<>).MakeGenericType(argument.GetType())) is not IValidator validator) continue;

            var result = await validator.ValidateAsync(new ValidationContext<object>(argument), context.HttpContext.RequestAborted);
            if (result.IsValid) continue;

            var errors = result.Errors
                .GroupBy(e => CamelCase(e.PropertyName))
                .ToDictionary(g => g.Key, g => g.Select(e => translator.Translate(e.ErrorMessage)).Distinct().ToArray());
            var first = errors.Values.First()[0];
            context.Result = new BadRequestObjectResult(new ValidationProblemDetails(errors)
            {
                Status = StatusCodes.Status400BadRequest,
                Title = first,
                Detail = first,
                Extensions = { ["code"] = "validation" },
            });
            return;
        }
        await next();
    }

    private static string CamelCase(string path) =>
        string.Join('.', path.Split('.').Select(p => p.Length == 0 ? p : char.ToLowerInvariant(p[0]) + p[1..]));
}
