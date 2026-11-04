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
}

