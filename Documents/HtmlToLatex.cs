using System.Net;
using System.Text.RegularExpressions;

namespace Dossier.Documents;

public static class HtmlToLatex
{
    private static readonly Regex Tokens = new(@"<!--[\s\S]*?-->|<\/?[a-zA-Z][a-zA-Z0-9]*\b[^>]*\/?>", RegexOptions.Compiled);
    private static readonly Regex Href = new("href\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s\"'`>]+))", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex TagName = new(@"^<\/?([a-zA-Z][a-zA-Z0-9]*)", RegexOptions.Compiled);
    private static readonly Regex AllowedHref = new(@"^(https?:|mailto:)", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly HashSet<string> Blocks =
        ["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "li", "ul", "ol"];

    public static List<string> Convert(string html)
    {
        var paragraphs = new List<string>();
        var currentParagraph = "";
        var boldDepth = 0;
        var skipDepth = 0;
        var trailingBreaks = 0;
        var links = new Stack<string?>();

        void AppendText(string rawText)
        {
            if (skipDepth > 0 || rawText.Length == 0)
            {
                return;
            }

            var text = DocumentRenderer.EscapeText(WebUtility.HtmlDecode(rawText));
            if (boldDepth > 0)
            {
                text = @"\textbf{" + text + "}";
            }

            var link = links.FirstOrDefault(value => value is not null);
            if (link is not null)
            {
                text = @"\href{" + DocumentRenderer.EscapeText(link) + "}{" + text + "}";
            }

            if (text.Length > 0)
            {
                trailingBreaks = 0;
            }

            currentParagraph += text;
        }

        void FlushParagraph(bool emitEmpty)
        {
            var text = currentParagraph.Trim();
            while (text.StartsWith(@"\\"))
            {
                text = text[2..].TrimStart();
            }

            var trailing = 0;
            while (text.EndsWith(@"\\"))
            {
                text = text[..^2].TrimEnd();
                trailing++;
            }

            if (text.Length > 0)
            {
                paragraphs.Add(text + @" \\[" + ((1 + trailing) * 6) + "pt]");
            }
            else if (emitEmpty)
            {
                paragraphs.Add(@"\\[" + (Math.Max(1, trailingBreaks) * 6) + "pt]");
            }

            currentParagraph = "";
            trailingBreaks = 0;
        }

        // Identify tags before decoding entities so typed text such as &lt;p&gt; stays text.
        var offset = 0;
        foreach (Match match in Tokens.Matches(html))
        {
            AppendText(html[offset..match.Index]);
            offset = match.Index + match.Length;

            var token = match.Value;
            if (token.StartsWith("<!--"))
            {
                continue;
            }

            var closing = token.StartsWith("</");
            var name = TagName.Match(token).Groups[1].Value.ToLowerInvariant();
            var selfClosing = token.EndsWith("/>") || name == "br";

            if (name is "script" or "style")
            {
                if (!closing && !selfClosing)
                {
                    skipDepth++;
                }
                else if (closing && skipDepth > 0)
                {
                    skipDepth--;
                }

                continue;
            }
            if (skipDepth > 0)
            {
                continue;
            }

            if (name == "br")
            {
                currentParagraph += @" \\ ";
                trailingBreaks++;
                continue;
            }
            if (Blocks.Contains(name))
            {
                FlushParagraph(closing);
                continue;
            }
            if (name is "b" or "strong")
            {
                if (!closing && !selfClosing)
                {
                    boldDepth++;
                }
                else if (closing && boldDepth > 0)
                {
                    boldDepth--;
                }

                continue;
            }
            if (name != "a")
            {
                continue;
            }

            if (!closing && !selfClosing)
            {
                var attribute = Href.Match(token);
                var rawUrl = attribute.Groups.Cast<Group>()
                    .Skip(1).FirstOrDefault(group => group.Success)?.Value ?? "";
                var url = WebUtility.HtmlDecode(rawUrl).Trim();
                links.Push(AllowedHref.IsMatch(url) ? url : null);
            }
            else if (closing && links.Count > 0)
            {
                links.Pop();
            }
        }

        AppendText(html[offset..]);
        FlushParagraph(false);
        return paragraphs;
    }
}
