using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

public sealed class HealthTests(ServerFactory factory) : IClassFixture<ServerFactory>
{
    [Fact]
    public async Task Health_returns_existing_contract()
    {
        using var client = factory.CreateClient();
        var response = await client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("ok", body.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Unknown_route_returns_existing_envelope()
    {
        using var client = factory.CreateClient();
        var response = await client.GetAsync("/missing");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("NOT_FOUND", body.GetProperty("error").GetProperty("code").GetString());
    }
}
