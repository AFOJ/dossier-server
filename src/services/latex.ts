/**
 * Compiles LaTeX source into a PDF by shelling out to tectonic.
 * Each compile gets its own temp directory; concurrency is capped because
 * compilation is CPU-heavy.
 */

import { execFile } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { LaTeXCompileError } from "../responses.js"

const DEFAULT_BIN = "tectonic"
const DEFAULT_TIMEOUT_MS = 30_000
const MAX_CONCURRENT_COMPILES = 2
const LOG_EXCERPT_MAX_CHARS = 2000
const LOG_EXCERPT_MAX_LINES = 40

export interface CompileOptions {
  binPath?: string
  timeoutMs?: number
}

// ---------------------------------------------------------------------------
// Concurrency gate
// ---------------------------------------------------------------------------

interface ExecOutcome {
  stdout: string
  stderr: string
}

function execAsPromise(
  bin: string,
  args: string[],
  options: { cwd: string; timeout: number },
): Promise<ExecOutcome> {
  return new Promise((resolve, reject) => {
    execFile(bin, args, options, (error, stdout, stderr) => {
      if (error) {
        Object.assign(error, { stdout, stderr })
        reject(error)
      } else {
        resolve({ stdout: String(stdout), stderr: String(stderr) })
      }
    })
  })
}

class Semaphore {
  private active = 0
  private readonly waiters: Array<() => void> = []

  constructor(private readonly limit: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    while (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.waiters.push(resolve))
    }
    this.active++
    try {
      return await task()
    } finally {
      this.active--
      this.waiters.shift()?.()
    }
  }

  get running(): number {
    return this.active
  }
}

const semaphore = new Semaphore(MAX_CONCURRENT_COMPILES)

export function activeCompilations(): number {
  return semaphore.running
}

async function readLogExcerpt(dir: string, fallback: string): Promise<string> {
  try {
    const logPath = path.join(dir, "main.log")
    const log = await readFile(logPath, "utf8")
    const lines = log.split("\n")
    const tail = lines.slice(-LOG_EXCERPT_MAX_LINES).join("\n")
    return tail.length > LOG_EXCERPT_MAX_CHARS ? tail.slice(-LOG_EXCERPT_MAX_CHARS) : tail
  } catch {
    return fallback
  }
}

// ---------------------------------------------------------------------------
// Compilation
// ---------------------------------------------------------------------------

/**
 * Compiles the given LaTeX source and resolves with the produced PDF.
 * Throws LaTeXCompileError (with a log excerpt) on any failure.
 */
export async function compileLatex(source: string, options: CompileOptions = {}): Promise<Buffer> {
  return semaphore.run(async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "dossier-"))
    try {
      await writeFile(path.join(dir, "main.tex"), source, "utf8")

      const bin = options.binPath ?? process.env.TECTONIC_BIN ?? DEFAULT_BIN
      const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

      let outcome: ExecOutcome
      try {
        outcome = await execAsPromise(bin, ["--keep-logs", "main.tex"], {
          cwd: dir,
          timeout: timeoutMs,
        })
      } catch (error) {
        const err = error as NodeJS.ErrnoException & {
          stderr?: string
          killed?: boolean
        }
        const reason = err.killed
          ? `compilation exceeded ${timeoutMs}ms and was terminated`
          : "tectonic exited with an error"
        const fallback = [err.message, err.stderr ?? ""].filter(Boolean).join("\n")
        throw new LaTeXCompileError(reason, await readLogExcerpt(dir, fallback))
      }

      const pdfPath = path.join(dir, "main.pdf")
      try {
        return await readFile(pdfPath)
      } catch {
        throw new LaTeXCompileError(
          "tectonic reported success but produced no PDF",
          await readLogExcerpt(dir, outcome.stderr),
        )
      }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
}

/** Verifies tectonic can produce a PDF; used by tests and health checks. */
export async function isTectonicAvailable(options: CompileOptions = {}): Promise<boolean> {
  try {
    const pdf = await compileLatex(
      "\\documentclass{article}\\begin{document}ok\\end{document}",
      options,
    )
    return pdf.length > 0
  } catch {
    return false
  }
}
