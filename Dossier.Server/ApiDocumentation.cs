using System.Text.Json.Nodes;

namespace Dossier.Server;

public static class ApiDocumentation
{
    public const string Html = """
        <!DOCTYPE html><html><head><title>Dossier API Reference</title>
        <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css"></head>
        <body><div id="swagger-ui"></div>
        <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
        <script>SwaggerUIBundle({url:'/docs/json',dom_id:'#swagger-ui',supportedSubmitMethods:[]});</script>
        </body></html>
        """;

    public static JsonObject Build()
    {
        var resume = JsonNode.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Schemas/resume.json")))!;
        var cover = JsonNode.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Schemas/cover-letter.json")))!;
        return new JsonObject
        {
            ["openapi"] = "3.1.0",
            ["info"] = new JsonObject { ["title"] = "Dossier API", ["version"] = "1.0.0" },
            ["paths"] = new JsonObject
            {
                ["/health"] = new JsonObject { ["get"] = new JsonObject { ["responses"] = new JsonObject { ["200"] = new JsonObject { ["description"] = "OK" } } } },
                ["/api/resumes/process"] = Operation("Generate resume PDF", resume),
                ["/api/cover-letters/process"] = Operation("Generate cover letter PDF", cover)
            }
        };
    }

    private static JsonObject Operation(string summary, JsonNode schema) => new()
    {
        ["post"] = new JsonObject
        {
            ["summary"] = summary,
            ["requestBody"] = new JsonObject
            {
                ["required"] = true,
                ["content"] = new JsonObject { ["application/json"] = new JsonObject { ["schema"] = schema } }
            },
            ["responses"] = new JsonObject { ["200"] = new JsonObject { ["description"] = "PDF generated", ["content"] = new JsonObject { ["application/pdf"] = new JsonObject() } } }
        }
    };
}
