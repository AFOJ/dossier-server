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
        var resume = (JsonObject)JsonNode.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Schemas/resume.json")))!;
        var cover = (JsonObject)JsonNode.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Schemas/cover-letter.json")))!;
        var components = new JsonObject();
        AddDefinitions(cover, components, true);
        AddDefinitions(resume, components, false);
        var resumeBody = Clean(resume, false);
        var coverBody = Clean(cover, true);
        return new JsonObject
        {
            ["openapi"] = "3.1.0",
            ["info"] = new JsonObject { ["title"] = "Dossier API", ["version"] = "1.0.0" },
            ["components"] = new JsonObject { ["schemas"] = components },
            ["paths"] = new JsonObject
            {
                ["/health"] = new JsonObject { ["get"] = new JsonObject { ["responses"] = new JsonObject { ["200"] = new JsonObject { ["description"] = "OK" } } } },
                ["/api/resumes/process"] = Operation("Generate resume PDF", resumeBody),
                ["/api/cover-letters/process"] = Operation("Generate cover letter PDF", coverBody)
            }
        };
    }

    private static void AddDefinitions(JsonObject schema, JsonObject components, bool cover)
    {
        foreach (var (name, definition) in (JsonObject)schema["definitions"]!)
            components[cover && name == "contact" ? "coverLetterContact" : name] = Clean(definition!, cover);
    }

    private static JsonNode Clean(JsonNode node, bool cover)
    {
        var clone = node.DeepClone();
        Rewrite(clone, cover);
        if (clone is JsonObject obj)
        {
            obj.Remove("$id"); obj.Remove("$schema"); obj.Remove("definitions");
        }
        return clone;
    }

    private static void Rewrite(JsonNode node, bool cover)
    {
        if (node is JsonObject obj)
        {
            if (obj["$ref"] is JsonValue reference)
            {
                var name = reference.GetValue<string>().Split('/').Last();
                obj["$ref"] = "#/components/schemas/" + (cover && name == "contact" ? "coverLetterContact" : name);
            }
            foreach (var child in obj.Select(x => x.Value).Where(x => x is not null)) Rewrite(child!, cover);
        }
        else if (node is JsonArray array)
            foreach (var child in array.Where(x => x is not null)) Rewrite(child!, cover);
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
