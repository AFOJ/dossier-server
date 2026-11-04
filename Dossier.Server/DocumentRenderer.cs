using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using HandlebarsDotNet;

namespace Dossier.Server;

public sealed class DocumentRenderer
{
    private readonly HandlebarsTemplate<object, object> _resume;
    private readonly HandlebarsTemplate<object, object> _coverLetter;
    private static readonly Regex Interpolation = new(@"(?<!\{)\{\{(?![#/>!{])(\w+)\}\}(?!\})", RegexOptions.Compiled);

    public DocumentRenderer()
    {
        var engine = Handlebars.Create();
        engine.RegisterHelper("sectionPartial", (_, arguments) => arguments[0]?.ToString() ?? "");
        engine.RegisterHelper("or", (_, arguments) => arguments.Take(arguments.Length - 1).Any(x => x is not null && !Equals(x, false) && x.ToString() != ""));
        var directory = Path.Combine(AppContext.BaseDirectory, "Templates");
        foreach (var file in Directory.GetFiles(Path.Combine(directory, "partials"), "*.hbs"))
            engine.RegisterTemplate(Path.GetFileNameWithoutExtension(file), Read(file));
        _resume = engine.Compile(Read(Path.Combine(directory, "resume.hbs")));
        _coverLetter = engine.Compile(Read(Path.Combine(directory, "cover-letter.hbs")));
    }

    // Handlebars.Net consumes one slash from each pair in template text.
    private static string Read(string file) => Interpolation.Replace(File.ReadAllText(file).Replace(@"\\", @"\\\\"), "{{{$1}}}");
    private static string S(JsonNode? obj, string key) => obj?[key]?.GetValue<string>() ?? "";
    private static JsonArray A(JsonNode? obj, string key) => obj?[key] as JsonArray ?? [];
    private static string Escape(string input) => Regex.Replace(input, @"[\\&%$#_{}~^]", match => match.Value switch
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
        _ => match.Value
    });
    private static string Arg(string value) => "{" + Escape(value) + "}";
    private static string RawArg(string value) => "{" + value + "}";
    private static string Dates(string start, string end) => start == end ? start : string.Join(" - ", new[] { start, end }.Where(x => !string.IsNullOrWhiteSpace(x)));
    private static Dictionary<string, object?> D(params (string, object?)[] values) => values.ToDictionary(x => x.Item1, x => x.Item2);
    private static object Bullet(JsonNode? bullet) => D(("titleArg", S(bullet, "type") == "text-with-title" ? Arg(S(bullet, "title")) : null), ("textArg", Arg(S(bullet, "text"))));

    public string Resume(JsonNode payload)
    {
        var contact = payload["contact"]!;
        var contactParts = new List<string>();
        if (S(contact, "email") is { Length: > 0 } email) { var e = Escape(email); contactParts.Add(@"\texttt{\href{mailto:" + e + "}{" + e + "}}"); }
        if (S(contact, "phone") is { Length: > 0 } phone) contactParts.Add(@"\texttt{" + Escape(phone) + "}");
        var links = A(contact, "links").Select(link => @"\href{" + Escape(S(link, "url")) + "}{" + Escape(S(link, "label")) + "}");
        var header = D(("nameLine", @"\textbf{\LARGE {" + Escape(S(contact, "full_name")) + "}}"),
            ("contactLine", string.Join(" · ", contactParts)), ("linksLine", string.Join(" · ", links)),
            ("roleArg", S(contact, "role") is { Length: > 0 } role ? Arg(role) : null),
            ("locationArg", S(contact, "location") is { Length: > 0 } location ? Arg(location) : null));
        return _resume(D(("header", header), ("sections", A(payload, "sections").Select(Section).ToList())));
    }

    private static object Section(JsonNode? section)
    {
        var type = S(section, "type");
        var result = D(("type", type), ("titleArg", Arg(S(section, "title"))));
        switch (type)
        {
            case "paragraph": result["textArg"] = Arg(S(section, "text")); break;
            case "skills": result["groups"] = A(section, "groups").Select(g => D(("titleArg", Arg(S(g, "title"))), ("itemsArg", Arg(string.Join(", ", A(g, "items").Select(x => x!.GetValue<string>())))))).ToList(); break;
            case "education": result["institutions"] = A(section, "institutions").Select(i => D(("nameArg", Arg(S(i, "name"))), ("datesArg", Arg(Dates(S(i, "start_date"), S(i, "end_date")))), ("degreeArg", Arg(S(i, "degree") + (S(i, "grade") is { Length: > 0 } grade ? " (" + grade + ")" : ""))), ("locationArg", Arg(S(i, "location"))), ("paragraphArg", S(i, "paragraph") is { Length: > 0 } paragraph ? Arg(paragraph) : null))).ToList(); break;
            case "experience": result["companies"] = A(section, "companies").Select(c => D(("websiteArg", S(c, "company_website") is { Length: > 0 } website ? Arg(website) : null), ("nameArg", Arg(S(c, "company_name"))), ("datesArg", Arg(Dates(S(c, "start_date"), S(c, "end_date")))), ("roles", A(c, "roles").Select(r => D(("roleLineArg", Arg(S(r, "job_title") + (string.Join(", ", new[] { S(r, "employment_type"), S(r, "location") }.Where(x => !string.IsNullOrWhiteSpace(x))) is { Length: > 0 } details ? " (" + details + ")" : ""))), ("datesArg", Arg(Dates(S(r, "start_date"), S(r, "end_date")))), ("bullets", A(r, "bullets").Select(Bullet).ToList()))).ToList()))).ToList(); break;
            case "projects":
                result["projects"] = A(section, "projects").Select(p =>
                {
                    var name = @"\textbf{" + Escape(S(p, "name")) + "}";
                    if (S(p, "url") is { Length: > 0 } url) name = @"\href{" + Escape(url) + "}{" + name + "}";
                    var tech = A(p, "technologies");
                    if (tech.Count > 0) name += @" $|$ \emph{" + string.Join(", ", tech.Select(x => Escape(x!.GetValue<string>()))) + "}";
                    return D(("headingArg", RawArg(name)), ("datesArg", Arg(Dates(S(p, "start_date"), S(p, "end_date")))), ("bullets", A(p, "bullets").Select(Bullet).ToList()));
                }).ToList(); break;
            case "list": result["items"] = A(section, "items").Select(i => D(("titleArg", S(i, "title") is { Length: > 0 } title ? Arg(title) : null), ("titleUrlArg", S(i, "url") is { Length: > 0 } url ? Arg(url) : null), ("descriptionArg", Arg(S(i, "description") + (S(i, "date") is { Length: > 0 } date ? " (" + date + ")" : ""))))).ToList(); break;
        }
        return result;
    }

    public string CoverLetter(JsonNode payload)
    {
        var contact = payload["contact"]!;
        var left = new List<string> { @"\textbf{\LARGE {" + Escape(S(contact, "full_name")) + "}}" };
        if (S(contact, "role") is { Length: > 0 } role) left.Add(@"\textit{" + Escape(role) + "}");
        var right = new List<string>();
        if (S(contact, "email") is { Length: > 0 } email) { var e = Escape(email); right.Add(@"\texttt{\href{mailto:" + e + "}{" + e + "}}"); }
        if (S(contact, "phone") is { Length: > 0 } phone) right.Add(@"\texttt{" + Escape(phone) + "}");
        if (S(contact, "location") is { Length: > 0 } location) right.Add(@"\texttt{" + Escape(location) + "}");
        var rows = Enumerable.Range(0, Math.Max(left.Count, right.Count)).Select(i => D(("left", i < left.Count ? left[i] : null), ("right", i < right.Count ? right[i] : null))).ToList();
        return _coverLetter(D(("headerRows", rows), ("dateLine", S(payload, "date") is { Length: > 0 } date ? Escape(date) : null), ("subjectLine", S(payload, "subject") is { Length: > 0 } subject ? @"\textbf{" + Escape(subject) + "}" : null), ("bodyParagraphs", HtmlToLatex.Convert(S(payload, "body")))));
    }

    internal static string EscapeText(string input) => Escape(input);
}
