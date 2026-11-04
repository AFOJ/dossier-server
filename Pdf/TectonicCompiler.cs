using System.Diagnostics;

namespace Dossier.Pdf;

public interface IPdfCompiler
{
    Task<byte[]> CompileAsync(string source, CancellationToken cancellationToken);
}

public sealed class CompileException(string message, string excerpt) : Exception(message)
{
    public string Excerpt { get; } = excerpt;
}

// Runs each LaTeX compilation in its own directory and removes the files afterwards.
public sealed class TectonicCompiler : IPdfCompiler
{
    // Bound both active processes and waiting requests so compilation cannot exhaust the host.
    private static readonly SemaphoreSlim Slots = new(2);
    private const int QueueLimit = 16;
    private static int _waiting;
    private readonly string _binary = Environment.GetEnvironmentVariable("TECTONIC_BIN") ?? "tectonic";

    public async Task<byte[]> CompileAsync(string source, CancellationToken cancellationToken)
    {
        if (Interlocked.Increment(ref _waiting) > QueueLimit)
        {
            Interlocked.Decrement(ref _waiting);
            throw new CompileException("compilation queue is full", "");
        }

        try { await Slots.WaitAsync(cancellationToken); }
        finally { Interlocked.Decrement(ref _waiting); }

        var directory = Path.Combine(Path.GetTempPath(), "dossier-" + Guid.NewGuid().ToString("N"));
        try
        {
            Directory.CreateDirectory(directory);
            await File.WriteAllTextAsync(Path.Combine(directory, "main.tex"), source, cancellationToken);
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(TimeSpan.FromSeconds(30));
            using var process = new Process
            {
                StartInfo = new ProcessStartInfo(_binary)
                {
                    WorkingDirectory = directory,
                    RedirectStandardError = true,
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    ArgumentList = { "--keep-logs", "main.tex" }
                }
            };
            try
            {
                process.Start();
                var stderr = process.StandardError.ReadToEndAsync(timeout.Token);
                var stdout = process.StandardOutput.ReadToEndAsync(timeout.Token);
                await process.WaitForExitAsync(timeout.Token);
                await Task.WhenAll(stderr, stdout);
                if (process.ExitCode != 0)
                {
                    throw new CompileException("tectonic exited with an error", await ReadExcerptAsync(directory, await stderr));
                }

                var pdf = Path.Combine(directory, "main.pdf");
                if (!File.Exists(pdf))
                {
                    throw new CompileException("tectonic reported success but produced no PDF", await ReadExcerptAsync(directory, await stderr));
                }

                return await File.ReadAllBytesAsync(pdf, cancellationToken);
            }
            catch (System.ComponentModel.Win32Exception error)
            {
                throw new CompileException("tectonic exited with an error", error.Message);
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                if (!process.HasExited)
                {
                    process.Kill(entireProcessTree: true);
                }

                throw new CompileException("compilation exceeded 30000ms and was terminated", await ReadExcerptAsync(directory, ""));
            }
            catch (OperationCanceledException)
            {
                if (!process.HasExited)
                {
                    process.Kill(entireProcessTree: true);
                }

                throw;
            }
        }
        finally
        {
            Directory.Delete(directory, recursive: true);
            Slots.Release();
        }
    }

    private static async Task<string> ReadExcerptAsync(string directory, string fallback)
    {
        var path = Path.Combine(directory, "main.log");
        if (!File.Exists(path))
        {
            return fallback.Length > 2000 ? fallback[^2000..] : fallback;
        }

        var lines = (await File.ReadAllLinesAsync(path)).TakeLast(40);
        var excerpt = string.Join('\n', lines);
        return excerpt.Length > 2000 ? excerpt[^2000..] : excerpt;
    }
}
