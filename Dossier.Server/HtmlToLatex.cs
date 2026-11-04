using System.Net;
using System.Text.RegularExpressions;

namespace Dossier.Server;

public static class HtmlToLatex
{
    private static readonly Regex Tokens = new(@"<!--[\s\S]*?-->|<\/?[a-zA-Z][a-zA-Z0-9]*\b[^>]*\/?>", RegexOptions.Compiled);
    private static readonly Regex Href = new("href\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s\"'`>]+))", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly HashSet<string> Blocks = ["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "li", "ul", "ol"];

    public static List<string> Convert(string html)
    {
        var result = new List<string>();
        var current = "";
        var bold = 0;
        var skipped = 0;
        var links = new Stack<string?>();
        var breaks = 0;
        void Text(string raw)
        {
            if (skipped > 0 || raw.Length == 0) return;
            var value = DocumentRenderer.EscapeText(WebUtility.HtmlDecode(raw));
            if (bold > 0) value = @"\textbf{" + value + "}";
            var link = links.FirstOrDefault(x => x is not null);
            if (link is not null) value = @"\href{" + DocumentRenderer.EscapeText(link) + "}{" + value + "}";
            if (value.Length > 0) breaks = 0;
            current += value;
        }
        void Flush(bool emitEmpty)
        {
            var value = current.Trim();
            while (value.StartsWith(@"\\")) value = value[2..].TrimStart();
            var trailing = 0;
            while (value.EndsWith(@"\\")) { value = value[..^2].TrimEnd(); trailing++; }
            if (value.Length > 0) result.Add(value + @" \\[" + ((1 + trailing) * 6) + "pt]");
            else if (emitEmpty) result.Add(@"\\[" + (Math.Max(1, breaks) * 6) + "pt]");
            current = "";
            breaks = 0;
        }
        var offset = 0;
        foreach (Match match in Tokens.Matches(html))
        {
            Text(html[offset..match.Index]);
            offset = match.Index + match.Length;
            var token = match.Value;
            if (token.StartsWith("<!--")) continue;
            var closing = token.StartsWith("</");
            var name = Regex.Match(token, @"^<\/?([a-zA-Z][a-zA-Z0-9]*)").Groups[1].Value.ToLowerInvariant();
            var selfClosing = token.EndsWith("/>") || name == "br";
            if (name is "script" or "style") { if (!closing && !selfClosing) skipped++; else if (closing && skipped > 0) skipped--; continue; }
            if (skipped > 0) continue;
            if (name == "br") { current += @" \\ "; breaks++; continue; }
            if (Blocks.Contains(name)) { Flush(closing); continue; }
            if (name is "b" or "strong") { if (!closing && !selfClosing) bold++; else if (closing && bold > 0) bold--; continue; }
            if (name == "a")
            {
                if (!closing && !selfClosing)
                {
                    var attribute = Href.Match(token);
                    var value = WebUtility.HtmlDecode(attribute.Groups.Cast<Group>().Skip(1).FirstOrDefault(x => x.Success)?.Value ?? "").Trim();
                    links.Push(Regex.IsMatch(value, @"^(https?:|mailto:)", RegexOptions.IgnoreCase) ? value : null);
                }
                else if (closing && links.Count > 0) links.Pop();
            }
        }
        Text(html[offset..]);
        Flush(false);
        return result;
    }
}
