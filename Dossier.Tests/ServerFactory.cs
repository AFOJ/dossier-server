using Dossier.Pdf;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

public sealed class ServerFactory : WebApplicationFactory<Program>
{
    private readonly IPdfCompiler _compiler;

    public ServerFactory() : this(new TestPdfCompiler()) { }

    internal ServerFactory(IPdfCompiler compiler) => _compiler = compiler;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
            services.Replace(ServiceDescriptor.Singleton(_compiler)));
    }
}

public sealed class TestPdfCompiler : IPdfCompiler
{
    public Task<byte[]> CompileAsync(string source, CancellationToken cancellationToken)
    {
        if (!source.Contains(@"\begin{document}", StringComparison.Ordinal))
        {
            throw new InvalidOperationException("The renderer did not produce a LaTeX document.");
        }

        return Task.FromResult("%PDF-test"u8.ToArray());
    }
}
