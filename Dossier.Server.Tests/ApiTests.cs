using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Dossier.Server;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Xunit;

public class ApiTests : IClassFixture<ApiTests.Factory>
{
    private readonly HttpClient _client;
    public ApiTests(Factory factory) => _client = factory.CreateClient();

    [Fact]
    public async Task Health_returns_existing_contract()
    {
        var response = await _client.GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("ok", (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("status").GetString());
    }

    [Theory]
    [InlineData("/api/resumes/process", "resume.pdf", "{\"title\":\"Test\",\"contact\":{\"full_name\":\"Jane Doe\"},\"sections\":[]}")]
    [InlineData("/api/cover-letters/process", "cover-letter.pdf", "{\"contact\":{\"full_name\":\"Jane Doe\"},\"body\":\"<p>Hello</p>\"}")]
    public async Task Valid_payload_returns_pdf_contract(string route, string file, string payload)
    {
        var response = await _client.PostAsync(route, new StringContent(payload, System.Text.Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/pdf", response.Content.Headers.ContentType?.MediaType);
        Assert.Contains(file, response.Content.Headers.ContentDisposition?.FileName);
        Assert.StartsWith("%PDF", await response.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData("{\"title\":\"\",\"contact\":{},\"sections\":[]}")]
    [InlineData("{\"title\":\"Test\",\"contact\":{\"full_name\":\"Jane\",\"unknown\":1},\"sections\":[]}")]
    public async Task Invalid_resume_returns_validation_envelope(string payload)
    {
        var response = await _client.PostAsync("/api/resumes/process", new StringContent(payload, System.Text.Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("VALIDATION_ERROR", body.GetProperty("error").GetProperty("code").GetString());
        Assert.True(body.GetProperty("error").GetProperty("details").GetArrayLength() > 0);
    }

    [Fact]
    public async Task Malformed_json_is_client_error()
    {
        var response = await _client.PostAsync("/api/resumes/process", new StringContent("{bad", System.Text.Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Unknown_route_returns_existing_envelope()
    {
        var response = await _client.GetAsync("/missing");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("NOT_FOUND", body.GetProperty("error").GetProperty("code").GetString());
    }


    [Fact]
    public async Task Compilation_failure_keeps_existing_error_contract()
    {
        using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
            builder.ConfigureServices(services => services.Replace(ServiceDescriptor.Singleton<IPdfCompiler>(new FailingCompiler()))));
        using var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/resumes/process", new { title = "Test", contact = new { full_name = "Jane" }, sections = Array.Empty<object>() });
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
    public sealed class Factory : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(Microsoft.AspNetCore.Hosting.IWebHostBuilder builder)
        {
            builder.ConfigureServices(services => services.Replace(ServiceDescriptor.Singleton<IPdfCompiler>(new FakeCompiler())));
        }
    }
    private sealed class FakeCompiler : IPdfCompiler
    {
        public Task<byte[]> CompileAsync(string source, CancellationToken cancellationToken)
        {
            Assert.Contains("\\begin{document}", source);
            return Task.FromResult(System.Text.Encoding.UTF8.GetBytes("%PDF-test"));
        }
    }
}
