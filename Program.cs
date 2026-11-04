using System.Text.Json;
using System.Text.Json.Nodes;
using Dossier.Api;
using Dossier.Documents;
using Dossier.Pdf;
using Dossier.Validation;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 1024 * 1024);
if (builder.Configuration["urls"] is null)
{
    var host = Environment.GetEnvironmentVariable("HOST") ?? "0.0.0.0";
    var port = Environment.GetEnvironmentVariable("PORT") ?? "3000";
    builder.WebHost.UseUrls($"http://{host}:{port}");
}

builder.Services.AddSingleton<PayloadValidator>();
builder.Services.AddSingleton<DocumentRenderer>();
builder.Services.AddSingleton<IPdfCompiler, TectonicCompiler>();

var origins = (Environment.GetEnvironmentVariable("CORS_ORIGINS") ?? "")
    .Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
if (origins.Length > 0)
{
    builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
        policy.WithOrigins(origins).WithMethods("GET", "POST").WithHeaders("Content-Type")));
}

var app = builder.Build();
if (origins.Length > 0)
{
    app.UseCors();
}

app.Use(async (context, next) =>
{
    try
    {
        await next(context);
    }
    catch (CompileException error)
    {
        context.Response.StatusCode = error.Message == "compilation queue is full" ? 503 : 422;
        await context.Response.WriteAsJsonAsync(ApiErrors.Compile(error.Message, error.Excerpt));
    }
    catch (BadHttpRequestException)
    {
        context.Response.StatusCode = 400;
        await context.Response.WriteAsJsonAsync(ApiErrors.Validation("Malformed request body"));
    }
    catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
    {
        // The client has gone; no response can be sent.
    }
    catch (Exception error)
    {
        app.Logger.LogError(error, "Request failed");
        if (!context.Response.HasStarted)
        {
            context.Response.StatusCode = 500;
            await context.Response.WriteAsJsonAsync(ApiErrors.Internal());
        }
    }
});

app.MapGet("/", () => Results.Redirect("/docs"));
app.MapGet("/docs", () => Results.Content(ApiDocumentation.Html, "text/html"));
app.MapGet("/docs/json", () => Results.Json(ApiDocumentation.Build()));
app.MapGet("/health", () => Results.Json(new { status = "ok" }));
app.MapPost("/api/resumes/process", (HttpContext context, PayloadValidator validator, DocumentRenderer renderer, IPdfCompiler compiler) =>
    Process(context, validator, renderer, compiler, resume: true));
app.MapPost("/api/cover-letters/process", (HttpContext context, PayloadValidator validator, DocumentRenderer renderer, IPdfCompiler compiler) =>
    Process(context, validator, renderer, compiler, resume: false));
app.MapFallback(() => Results.Json(ApiErrors.NotFound(), statusCode: 404));
app.Run();

static async Task<IResult> Process(HttpContext context, PayloadValidator validator, DocumentRenderer renderer, IPdfCompiler compiler, bool resume)
{
    JsonNode? payload;
    try
    {
        payload = await JsonNode.ParseAsync(context.Request.Body, cancellationToken: context.RequestAborted);
    }
    catch (JsonException)
    {
        return Results.Json(ApiErrors.Validation("Malformed request body"), statusCode: 400);
    }

    var issues = validator.Validate(payload, resume);
    if (issues.Count > 0)
    {
        return Results.Json(ApiErrors.Validation(details: issues.Cast<object>().ToArray()), statusCode: 400);
    }

    var source = resume ? renderer.Resume(payload!) : renderer.CoverLetter(payload!);
    var pdf = await compiler.CompileAsync(source, context.RequestAborted);
    var filename = resume ? "resume.pdf" : "cover-letter.pdf";
    context.Response.Headers.ContentDisposition = $"inline; filename=\"{filename}\"";
    return Results.File(pdf, "application/pdf");
}
