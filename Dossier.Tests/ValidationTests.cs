using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Xunit;

public sealed class ValidationTests(ServerFactory factory) : IClassFixture<ServerFactory>
{
    [Theory]
    [InlineData("{\"title\":\"\",\"contact\":{},\"sections\":[]}")]
    [InlineData(
        "{\"title\":\"Test\",\"contact\":{\"full_name\":\"Jane\",\"unknown\":1},\"sections\":[]}"
    )]
    public async Task Invalid_resume_returns_validation_details(string payload)
    {
        using var client = factory.CreateClient();
        var response = await client.PostAsync(
            "/api/resumes/process",
            new StringContent(payload, Encoding.UTF8, "application/json")
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("VALIDATION_ERROR", body.GetProperty("error").GetProperty("code").GetString());
        Assert.True(body.GetProperty("error").GetProperty("details").GetArrayLength() > 0);
    }

    [Fact]
    public async Task Malformed_json_is_client_error()
    {
        using var client = factory.CreateClient();
        var response = await client.PostAsync(
            "/api/resumes/process",
            new StringContent("{bad", Encoding.UTF8, "application/json")
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("VALIDATION_ERROR", body.GetProperty("error").GetProperty("code").GetString());
    }
}
