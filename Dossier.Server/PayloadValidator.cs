using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace Dossier.Server;

public sealed record ValidationIssue([property: JsonPropertyName("path")] string Path, [property: JsonPropertyName("message")] string Message);

public sealed class PayloadValidator
{
    private readonly JsonNode _resume = JsonNode.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Schemas/resume.json")))!;
    private readonly JsonNode _coverLetter = JsonNode.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Schemas/cover-letter.json")))!;

    public IReadOnlyList<ValidationIssue> Validate(JsonNode? payload, bool resume)
    {
        var errors = new List<ValidationIssue>();
        var root = resume ? _resume : _coverLetter;
        Check(payload, root, root, "", errors);
        return errors;
    }

    private static void Check(JsonNode? value, JsonNode schema, JsonNode root, string path, List<ValidationIssue> errors)
    {
        if (schema["$ref"] is JsonValue reference)
        {
            var name = reference.GetValue<string>().Split('/').Last();
            Check(value, root["definitions"]![name]!, root, path, errors);
            return;
        }
        if (schema["oneOf"] is JsonArray alternatives)
        {
            if (!alternatives.Any(option => Valid(value, option!, root))) errors.Add(new(path, "must match exactly one schema in oneOf"));
            return;
        }
        if (schema["anyOf"] is JsonArray options)
        {
            if (!options.Any(option => Valid(value, option!, root))) errors.Add(new(path, "must match a schema in anyOf"));
            return;
        }
        if (schema["required"] is JsonArray conditionalRequired && schema["type"] is null && value is JsonObject conditionalObject)
            foreach (var name in conditionalRequired.Select(x => x!.GetValue<string>()))
                if (!conditionalObject.ContainsKey(name)) errors.Add(new(path, "must have required property '" + name + "'"));
        if (schema["if"] is JsonNode condition && Valid(value, condition, root) && schema["then"] is JsonNode consequence)
            Check(value, consequence, root, path, errors);
        if (schema["const"] is JsonNode constant && !JsonNode.DeepEquals(value, constant))
            errors.Add(new(path, "must be equal to constant"));
        var type = schema["type"]?.GetValue<string>();
        if (type == "null")
        {
            if (value is not null) errors.Add(new(path, "must be null"));
            return;
        }
        if (type == "string")
        {
            if (value is not JsonValue scalar || !scalar.TryGetValue<string>(out var text))
            {
                errors.Add(new(path, "must be string"));
                return;
            }
            if (schema["minLength"] is JsonValue minimum && text.Length < minimum.GetValue<int>())
                errors.Add(new(path, "must NOT have fewer than 1 characters"));
            if (schema["pattern"] is JsonValue pattern && !Regex.IsMatch(text, pattern.GetValue<string>()))
                errors.Add(new(path, "must match pattern"));
            return;
        }
        if (type == "array")
        {
            if (value is not JsonArray array) { errors.Add(new(path, "must be array")); return; }
            if (schema["minItems"] is JsonValue min && array.Count < min.GetValue<int>()) errors.Add(new(path, "must NOT have fewer items"));
            if (schema["items"] is JsonNode itemSchema)
                for (var i = 0; i < array.Count; i++) Check(array[i], itemSchema, root, path + "/" + i, errors);
            return;
        }
        if (type == "object")
        {
            if (value is not JsonObject obj) { errors.Add(new(path, "must be object")); return; }
            var properties = schema["properties"] as JsonObject;
            if (schema["required"] is JsonArray required)
                foreach (var name in required.Select(x => x!.GetValue<string>()))
                    if (!obj.ContainsKey(name)) errors.Add(new(path, "must have required property '" + name + "'"));
            foreach (var (name, child) in obj)
            {
                if (properties is null || !properties.TryGetPropertyValue(name, out var propertySchema))
                {
                    if (schema["additionalProperties"]?.GetValue<bool>() == false) errors.Add(new(path, "must NOT have additional properties"));
                }
                else Check(child, propertySchema!, root, path + "/" + name, errors);
            }
        }
    }

    private static bool Valid(JsonNode? value, JsonNode schema, JsonNode root)
    {
        var errors = new List<ValidationIssue>();
        Check(value, schema, root, "", errors);
        return errors.Count == 0;
    }
}


