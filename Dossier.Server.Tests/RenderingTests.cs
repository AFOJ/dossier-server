using System.Text.Json.Nodes;
using Dossier.Server;
using Xunit;

public class RenderingTests
{
    [Fact]
    public void Resume_escapes_user_content_and_preserves_layout()
    {
        var renderer = new DocumentRenderer();
        var source = renderer.Resume(JsonNode.Parse("""{"title":"Test","contact":{"full_name":"Jane & Doe"},"sections":[{"type":"paragraph","title":"Profile","text":"C# & .NET"}]}""")!);
        Assert.Contains(@"Jane \& Doe", source);
        Assert.Contains(@"C\# \& .NET", source);
        Assert.Contains(@"\section", source);
    }

    [Fact]
    public void Cover_letter_keeps_bold_and_escapes_text()
    {
        var renderer = new DocumentRenderer();
        var source = renderer.CoverLetter(JsonNode.Parse("""{"contact":{"full_name":"Jane"},"body":"<p>Hello <strong>A&B</strong></p>"}""")!);
        Assert.Contains(@"\textbf{A\&B}", source);
    }

    [Fact]
    public void Resume_renders_all_section_types()
    {
        var renderer = new DocumentRenderer();
        var payload = JsonNode.Parse("""{"title":"Test","contact":{"full_name":"Jane"},"sections":[{"type":"education","title":"Education","institutions":[{"name":"University","degree":"BSc"}]},{"type":"skills","title":"Skills","groups":[{"title":"Languages","items":["C#"]}]},{"type":"experience","title":"Experience","companies":[{"company_name":"Acme","roles":[{"job_title":"Engineer","bullets":[{"type":"text","text":"Built systems"}]}]}]},{"type":"list","title":"Talks","items":[{"description":"Conference"}]},{"type":"projects","title":"Projects","projects":[{"name":"Dossier","technologies":["C#"],"bullets":[]}]}]}""")!;
        var source = renderer.Resume(payload);
        Assert.Contains(@"\education", source);
        Assert.Contains(@"\resumeSubItem", source);
        Assert.Contains(@"\employerTitlePlain", source);
        Assert.Contains(@"\resumeProjectHeading", source);
        Assert.Contains("Conference", source);
    }
}
