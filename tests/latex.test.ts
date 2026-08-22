import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type ChildProcess from "node:child_process"
import { readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof ChildProcess>()
  return { ...actual, execFile: mockExecFile }
})

const execCalls: Array<{ bin: string; args: string[]; options: unknown }> = []

// Overridden per-test; defaults to a successful no-op compilation.
let execBehavior: (
  bin: string,
  args: string[],
  options: { cwd: string },
) => Promise<void> = async () => {}

function mockExecFile(
  bin: string,
  args: string[],
  options: { cwd: string; timeout?: number },
  callback: (error: Error | null, stdout: string, stderr: string) => void,
): void {
  execCalls.push({ bin, args, options })
  execBehavior(bin, args, options)
    .then(() => callback(null, "", ""))
    .catch((error) => {
      const err = error as Error & { stderr?: string; killed?: boolean }
      Object.assign(err, { stderr: err.stderr ?? "" })
      callback(err, "", err.stderr ?? "")
    })
}

/** Simulates tectonic: writes main.pdf (and optional log) into its cwd. */
function fakeTectonic(artifacts: {
  pdf?: Buffer | null
  log?: string
  exitError?: Error & { killed?: boolean }
  delayMs?: number
}): void {
  execBehavior = async (_bin, _args, options) => {
    if (artifacts.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, artifacts.delayMs))
    }
    // Real tectonic writes logs before exiting, so do the same.
    if (artifacts.pdf) {
      await writeFile(path.join(options.cwd, "main.pdf"), artifacts.pdf)
    }
    if (artifacts.log !== undefined) {
      await writeFile(path.join(options.cwd, "main.log"), artifacts.log)
    }
    if (artifacts.exitError) throw artifacts.exitError
  }
}

import { compileLatex, LaTeXCompileError, activeCompilations } from "../src/services/latex.js"

beforeEach(() => {
  execCalls.length = 0
  fakeTectonic({ pdf: Buffer.from("%PDF-fake") })
})

afterEach(async () => {
  // Wait for any in-flight compiles so tests don't leak state.
  while (activeCompilations() > 0) {
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
})

describe("compileLatex", () => {
  it("compiles the happy path: writes source, invokes tectonic, returns PDF, cleans up", async () => {
    let seenCwd = ""
    let written = ""
    execBehavior = async (_bin, _args, options) => {
      seenCwd = options.cwd
      written = await readFile(path.join(options.cwd, "main.tex"), "utf8")
      await writeFile(path.join(options.cwd, "main.pdf"), "%PDF-fake")
    }

    const pdf = await compileLatex("\\documentclass{article}hi")

    expect(pdf).toEqual(Buffer.from("%PDF-fake"))
    expect(written).toBe("\\documentclass{article}hi")
    const call = execCalls[0]!
    expect(call.bin).toBe("tectonic")
    expect(call.args).toEqual(["--keep-logs", "main.tex"])
    expect(path.basename(seenCwd)).toMatch(/^dossier-/)
    // Temp directory is removed after compilation.
    await expect(stat(seenCwd)).rejects.toThrow()
  })

  it("resolves the tectonic binary: explicit binPath beats $TECTONIC_BIN beats PATH", async () => {
    process.env.TECTONIC_BIN = "/opt/tectonic"
    try {
      await compileLatex("x")
      expect(execCalls[0]!.bin).toBe("/opt/tectonic")

      execCalls.length = 0
      await compileLatex("x", { binPath: "/usr/local/bin/tectonic" })
      expect(execCalls[0]!.bin).toBe("/usr/local/bin/tectonic")
    } finally {
      delete process.env.TECTONIC_BIN
    }
  })

  it.each([
    {
      name: "compiler failure surfaces the log tail",
      artifacts: {
        exitError: new Error("exit code 1"),
        log: "line1\nline2\n./main.tex:42: Missing $ inserted.",
      },
      messageFragment: "exited with an error",
      excerptFragment: "Missing $ inserted.",
    },
    {
      name: "compiler failure without a log falls back to stderr",
      artifacts: {
        pdf: null,
        exitError: Object.assign(new Error("panic"), {
          stderr: "! Undefined control sequence.",
        }),
      },
      messageFragment: "exited with an error",
      excerptFragment: "Undefined control sequence.",
    },
    {
      name: "success exit but no PDF is reported",
      artifacts: { pdf: null, log: "all quiet" },
      messageFragment: "no PDF",
      excerptFragment: "",
    },
    {
      name: "timeouts are reported as terminated compilations",
      artifacts: {
        pdf: null,
        exitError: Object.assign(new Error("killed"), { killed: true }),
      },
      messageFragment: "terminated",
      excerptFragment: "",
    },
  ])("$name", async ({ artifacts, messageFragment, excerptFragment }) => {
    fakeTectonic(artifacts)
    const error = await compileLatex("source").catch((e) => e)
    expect(error).toBeInstanceOf(LaTeXCompileError)
    expect(error.message).toContain(messageFragment)
    if (excerptFragment) {
      expect(error.logExcerpt).toContain(excerptFragment)
    }
  })

  it("caps concurrent compilations", async () => {
    let inFlight = 0
    let peak = 0
    execBehavior = async (_bin, _args, options) => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 30))
      await writeFile(path.join(options.cwd, "main.pdf"), "%PDF")
      inFlight--
    }

    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        compileLatex("source").then(
          () => "ok",
          () => "error",
        ),
      ),
    )

    expect(results).toEqual(Array.from({ length: 6 }, () => "ok"))
    expect(peak).toBeLessThanOrEqual(2)
  })
})
