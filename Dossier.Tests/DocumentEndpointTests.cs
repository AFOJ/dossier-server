using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Dossier.Pdf;
using Xunit;

public sealed class DocumentEndpointTests(ServerFactory factory) : IClassFixture<ServerFactory>
{
    [Theory]
    [InlineData(
        "/api/resumes/process",
        "resume.pdf",
        "{\"title\":\"Test\",\"contact\":{\"full_name\":\"Jane Doe\"},\"sections\":[]}"
    )]
    [InlineData(
        "/api/cover-letters/process",
        "cover-letter.pdf",
        "{\"contact\":{\"full_name\":\"Jane Doe\"},\"body\":\"<p>Hello</p>\"}"
    )]
    public async Task Valid_document_returns_pdf_contract(
        string route,
        string filename,
        string payload
    )
    {
        using var client = factory.CreateClient();
        var response = await client.PostAsync(
            route,
            new StringContent(payload, Encoding.UTF8, "application/json")
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/pdf", response.Content.Headers.ContentType?.MediaType);
        Assert.Contains(filename, response.Content.Headers.ContentDisposition?.FileName);
        Assert.StartsWith("%PDF", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Compilation_failure_returns_existing_error_contract()
    {
        using var failureFactory = new ServerFactory(new FailingCompiler());
        using var client = failureFactory.CreateClient();
        var request = new
        {
            title = "Test",
            contact = new { full_name = "Jane" },
            sections = Array.Empty<object>(),
        };
        var response = await client.PostAsJsonAsync("/api/resumes/process", request);

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("COMPILE_ERROR", body.GetProperty("error").GetProperty("code").GetString());
        Assert.Contains("Missing", body.GetProperty("error").GetProperty("details")[0].GetString());
    }

    private sealed class FailingCompiler : IPdfCompiler
    {
        public Task<byte[]> CompileAsync(string source, CancellationToken cancellationToken) =>
            throw new CompileException("tectonic exited with an error", "Missing character");
    }
}
