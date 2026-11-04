using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using HandlebarsDotNet;

namespace Dossier.Documents;

public sealed class DocumentRenderer
{
    private readonly HandlebarsTemplate<object, object> _resume;
    private readonly HandlebarsTemplate<object, object> _coverLetter;

    private static readonly Regex Interpolation = new(
        @"(?<!\{)\{\{(?![#/>!{])(\w+)\}\}(?!\})",
        RegexOptions.Compiled
    );

    private static readonly Regex LatexSpecials = new(@"[\\&%$#_{}~^]", RegexOptions.Compiled);

    public DocumentRenderer()
    {
        var engine = Handlebars.Create();
        engine.RegisterHelper("sectionPartial", (_, arguments) => arguments[0]?.ToString() ?? "");
        engine.RegisterHelper(
            "or",
            (_, arguments) =>
                arguments.Any(value =>
                    value is not null && !Equals(value, false) && value.ToString() != ""
                )
        );

        var directory = Path.Combine(AppContext.BaseDirectory, "Templates");
        foreach (var file in Directory.GetFiles(Path.Combine(directory, "partials"), "*.hbs"))
        {
            engine.RegisterTemplate(Path.GetFileNameWithoutExtension(file), ReadTemplate(file));
        }

        _resume = engine.Compile(ReadTemplate(Path.Combine(directory, "resume.hbs")));
        _coverLetter = engine.Compile(ReadTemplate(Path.Combine(directory, "cover-letter.hbs")));
    }

    // Handlebars.Net consumes one slash from each pair in template text.
    private static string ReadTemplate(string file)
    {
        var source = File.ReadAllText(file).Replace(@"\\", @"\\\\");
        return Interpolation.Replace(source, "{{{$1}}}");
    }

    private static string GetString(JsonNode? node, string key) =>
        node?[key]?.GetValue<string>() ?? "";

    private static JsonArray GetArray(JsonNode? node, string key) => node?[key] as JsonArray ?? [];

    private static string Argument(string value) => "{" + EscapeText(value) + "}";

    private static string TrustedArgument(string value) => "{" + value + "}";

    private static Dictionary<string, object?> Model(params (string Key, object? Value)[] values) =>
        values.ToDictionary(value => value.Key, value => value.Value);

    internal static string EscapeText(string input) =>
        LatexSpecials.Replace(
            input,
            match =>
                match.Value switch
                {
                    "\\" => @"\textbackslash{}",
                    "&" => @"\&",
                    "%" => @"\%",
                    "$" => @"\$",
                    "#" => @"\#",
                    "_" => @"\_",
                    "{" => @"\{",
                    "}" => @"\}",
                    "~" => @"\textasciitilde{}",
                    "^" => @"\textasciicircum{}",
                    _ => match.Value,
                }
        );

    private static string DateRange(JsonNode? node)
    {
        var start = GetString(node, "start_date");
        var end = GetString(node, "end_date");
        if (start == end)
        {
            return start;
        }

        return string.Join(
            " - ",
            new[] { start, end }.Where(date => !string.IsNullOrWhiteSpace(date))
        );
    }

    public string Resume(JsonNode payload)
    {
        var contact = payload["contact"]!;
        var contactParts = new List<string>();

        if (GetString(contact, "email") is { Length: > 0 } email)
        {
            var escapedEmail = EscapeText(email);
            contactParts.Add(@"\texttt{\href{mailto:" + escapedEmail + "}{" + escapedEmail + "}}");
        }

        if (GetString(contact, "phone") is { Length: > 0 } phone)
        {
            contactParts.Add(@"\texttt{" + EscapeText(phone) + "}");
        }

        var links = GetArray(contact, "links")
            .Select(link =>
                @"\href{"
                + EscapeText(GetString(link, "url"))
                + "}{"
                + EscapeText(GetString(link, "label"))
                + "}"
            );

        var header = Model(
            ("nameLine", @"\textbf{\LARGE {" + EscapeText(GetString(contact, "full_name")) + "}}"),
            ("contactLine", string.Join(" · ", contactParts)),
            ("linksLine", string.Join(" · ", links)),
            ("roleArg", GetString(contact, "role") is { Length: > 0 } role ? Argument(role) : null),
            (
                "locationArg",
                GetString(contact, "location") is { Length: > 0 } location
                    ? Argument(location)
                    : null
            )
        );

        var sections = GetArray(payload, "sections").Select(Section).ToList();
        return _resume(Model(("header", header), ("sections", sections)));
    }

    private static object Section(JsonNode? section)
    {
        var type = GetString(section, "type");
        var model = Model(("type", type), ("titleArg", Argument(GetString(section, "title"))));

        switch (type)
        {
            case "paragraph":
                model["textArg"] = Argument(GetString(section, "text"));
                break;
            case "skills":
                model["groups"] = GetArray(section, "groups").Select(SkillGroup).ToList();
                break;
            case "education":
                model["institutions"] = GetArray(section, "institutions")
                    .Select(Institution)
                    .ToList();
                break;
            case "experience":
                model["companies"] = GetArray(section, "companies").Select(Company).ToList();
                break;
            case "projects":
                model["projects"] = GetArray(section, "projects").Select(Project).ToList();
                break;
            case "list":
                model["items"] = GetArray(section, "items").Select(ListItem).ToList();
                break;
        }

        return model;
    }

    private static object SkillGroup(JsonNode? group) =>
        Model(
            ("titleArg", Argument(GetString(group, "title"))),
            (
                "itemsArg",
                Argument(
                    string.Join(
                        ", ",
                        GetArray(group, "items").Select(item => item!.GetValue<string>())
                    )
                )
            )
        );

    private static object Institution(JsonNode? institution)
    {
        var degree = GetString(institution, "degree");
        if (GetString(institution, "grade") is { Length: > 0 } grade)
        {
            degree += " (" + grade + ")";
        }

        var paragraph = GetString(institution, "paragraph");
        return Model(
            ("nameArg", Argument(GetString(institution, "name"))),
            ("datesArg", Argument(DateRange(institution))),
            ("degreeArg", Argument(degree)),
            ("locationArg", Argument(GetString(institution, "location"))),
            ("paragraphArg", paragraph.Length > 0 ? Argument(paragraph) : null)
        );
    }

    private static object Company(JsonNode? company)
    {
        var website = GetString(company, "company_website");
        return Model(
            ("websiteArg", website.Length > 0 ? Argument(website) : null),
            ("nameArg", Argument(GetString(company, "company_name"))),
            ("datesArg", Argument(DateRange(company))),
            ("roles", GetArray(company, "roles").Select(Role).ToList())
        );
    }

    private static object Role(JsonNode? role)
    {
        var details = string.Join(
            ", ",
            new[] { GetString(role, "employment_type"), GetString(role, "location") }.Where(value =>
                !string.IsNullOrWhiteSpace(value)
            )
        );
        var title = GetString(role, "job_title");
        if (details.Length > 0)
        {
            title += " (" + details + ")";
        }

        return Model(
            ("roleLineArg", Argument(title)),
            ("datesArg", Argument(DateRange(role))),
            ("bullets", GetArray(role, "bullets").Select(Bullet).ToList())
        );
    }

    private static object Bullet(JsonNode? bullet) =>
        Model(
            (
                "titleArg",
                GetString(bullet, "type") == "text-with-title"
                    ? Argument(GetString(bullet, "title"))
                    : null
            ),
            ("textArg", Argument(GetString(bullet, "text")))
        );

    private static object Project(JsonNode? project)
    {
        var heading = @"\textbf{" + EscapeText(GetString(project, "name")) + "}";
        if (GetString(project, "url") is { Length: > 0 } url)
        {
            heading = @"\href{" + EscapeText(url) + "}{" + heading + "}";
        }

        var technologies = GetArray(project, "technologies");
        if (technologies.Count > 0)
        {
            var names = string.Join(
                ", ",
                technologies.Select(item => EscapeText(item!.GetValue<string>()))
            );
            heading += @" $|$ \emph{" + names + "}";
        }

        return Model(
            ("headingArg", TrustedArgument(heading)),
            ("datesArg", Argument(DateRange(project))),
            ("bullets", GetArray(project, "bullets").Select(Bullet).ToList())
        );
    }

    private static object ListItem(JsonNode? item)
    {
        var title = GetString(item, "title");
        var url = GetString(item, "url");
        var description = GetString(item, "description");
        if (GetString(item, "date") is { Length: > 0 } date)
        {
            description += " (" + date + ")";
        }

        return Model(
            ("titleArg", title.Length > 0 ? Argument(title) : null),
            ("titleUrlArg", url.Length > 0 ? Argument(url) : null),
            ("descriptionArg", Argument(description))
        );
    }

    public string CoverLetter(JsonNode payload)
    {
        var contact = payload["contact"]!;
        var left = new List<string>
        {
            @"\textbf{\LARGE {" + EscapeText(GetString(contact, "full_name")) + "}}",
        };
        if (GetString(contact, "role") is { Length: > 0 } role)
        {
            left.Add(@"\textit{" + EscapeText(role) + "}");
        }

        var right = new List<string>();
        if (GetString(contact, "email") is { Length: > 0 } email)
        {
            var escapedEmail = EscapeText(email);
            right.Add(@"\texttt{\href{mailto:" + escapedEmail + "}{" + escapedEmail + "}}");
        }
        if (GetString(contact, "phone") is { Length: > 0 } phone)
        {
            right.Add(@"\texttt{" + EscapeText(phone) + "}");
        }
        if (GetString(contact, "location") is { Length: > 0 } location)
        {
            right.Add(@"\texttt{" + EscapeText(location) + "}");
        }

        var rows = Enumerable
            .Range(0, Math.Max(left.Count, right.Count))
            .Select(index =>
                Model(
                    ("left", index < left.Count ? left[index] : null),
                    ("right", index < right.Count ? right[index] : null)
                )
            )
            .ToList();

        var date = GetString(payload, "date");
        var subject = GetString(payload, "subject");
        return _coverLetter(
            Model(
                ("headerRows", rows),
                ("dateLine", date.Length > 0 ? EscapeText(date) : null),
                (
                    "subjectLine",
                    subject.Length > 0 ? @"\textbf{" + EscapeText(subject) + "}" : null
                ),
                ("bodyParagraphs", HtmlToLatex.Convert(GetString(payload, "body")))
            )
        );
    }
}
