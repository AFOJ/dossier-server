namespace Dossier.Api;

public sealed record ApiError(string Code, string Message, IReadOnlyList<object> Details);
public sealed record ErrorEnvelope(ApiError Error);

public static class ApiErrors
{
    public static ErrorEnvelope Validation(string message = "Invalid request", IReadOnlyList<object>? details = null) =>
        new(new("VALIDATION_ERROR", message, details ?? []));

    public static ErrorEnvelope NotFound() =>
        new(new("NOT_FOUND", "Route not found", []));

    public static ErrorEnvelope Compile(string message, string excerpt) =>
        new(new("COMPILE_ERROR", message, [excerpt]));

    public static ErrorEnvelope Internal() =>
        new(new("INTERNAL_ERROR", "Unexpected server error", []));
}
