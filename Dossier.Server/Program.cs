using System.Text.Json;
using System.Text.Json.Nodes;
using Dossier.Server;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 1024 * 1024);
builder.Services.AddSingleton<PayloadValidator>();
builder.Services.AddSingleton<DocumentRenderer>();
builder.Services.AddSingleton<IPdfCompiler, TectonicCompiler>();
var origins = (Environment.GetEnvironmentVariable("CORS_ORIGINS") ?? "").Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
if (origins.Length > 0) builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy.WithOrigins(origins).WithMethods("GET", "POST").WithHeaders("Content-Type")));
var app = builder.Build();
if (origins.Length > 0) app.UseCors();
app.Use(async (context, next) =>
{
    try { await next(context); }
    catch (CompileException error)
    {
        context.Response.StatusCode = error.Message == "compilation queue is full" ? 503 : 422;
        await context.Response.WriteAsJsonAsync(new { error = new { code = "COMPILE_ERROR", message = error.Message, details = new[] { error.Excerpt } } });
    }
    catch (BadHttpRequestException)
    {
        context.Response.StatusCode = 400;
        await context.Response.WriteAsJsonAsync(new { error = new { code = "VALIDATION_ERROR", message = "Malformed request body", details = Array.Empty<object>() } });
    }
    catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested) { }
    catch (Exception error)
    {
        app.Logger.LogError(error, "Request failed");
        if (!context.Response.HasStarted)
        {
            context.Response.StatusCode = 500;
            await context.Response.WriteAsJsonAsync(new { error = new { code = "INTERNAL_ERROR", message = "Unexpected server error", details = Array.Empty<object>() } });
        }
    }
});
app.MapGet("/", () => Results.Redirect("/docs"));
app.MapGet("/docs", () => Results.Content(ApiDocumentation.Html, "text/html"));
app.MapGet("/docs/json", () => Results.Json(ApiDocumentation.Build()));
app.MapGet("/health", () => Results.Json(new { status = "ok" }));
app.MapPost("/api/resumes/process", (HttpContext context, PayloadValidator validator, DocumentRenderer renderer, IPdfCompiler compiler) => Process(context, validator, renderer, compiler, true));
app.MapPost("/api/cover-letters/process", (HttpContext context, PayloadValidator validator, DocumentRenderer renderer, IPdfCompiler compiler) => Process(context, validator, renderer, compiler, false));
app.MapFallback(() => Results.Json(new { error = new { code = "NOT_FOUND", message = "Route not found", details = Array.Empty<object>() } }, statusCode: 404));
app.Run();

static async Task<IResult> Process(HttpContext context, PayloadValidator validator, DocumentRenderer renderer, IPdfCompiler compiler, bool resume)
{
    JsonNode? payload;
    try { payload = await JsonNode.ParseAsync(context.Request.Body, cancellationToken: context.RequestAborted); }
    catch (JsonException) { return Results.Json(new { error = new { code = "VALIDATION_ERROR", message = "Malformed request body", details = Array.Empty<object>() } }, statusCode: 400); }
    var issues = validator.Validate(payload, resume);
    if (issues.Count > 0) return Results.Json(new { error = new { code = "VALIDATION_ERROR", message = "Invalid request", details = issues } }, statusCode: 400);
    var source = resume ? renderer.Resume(payload!) : renderer.CoverLetter(payload!);
    var pdf = await compiler.CompileAsync(source, context.RequestAborted);
    context.Response.Headers.ContentDisposition = "inline; filename=\"" + (resume ? "resume.pdf" : "cover-letter.pdf") + "\"";
    return Results.File(pdf, "application/pdf");
}

public partial class Program { }


