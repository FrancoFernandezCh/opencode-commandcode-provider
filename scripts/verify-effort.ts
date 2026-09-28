import { spawn } from "child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

// Verifies that model variants reach the provider as `reasoningEffort`.
//
// It swaps the Command Code provider package for a local probe package, runs
// OpenCode with an isolated config, and checks what the provider received.
// No Command Code credits are used and no request leaves the machine.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const DEFAULT_MODEL = "deepseek/deepseek-v4-flash"
const RUN_TIMEOUT_MS = 120_000

interface ModelEntry {
  id: string
  reasoning_efforts?: string[]
}

// Provider package that records the options OpenCode passes to the factory.
const PROBE_PACKAGE = `import { appendFileSync } from "fs"

export function createEffortProbe(options) {
  appendFileSync(process.env.CC_EFFORT_LOG, JSON.stringify({ reasoningEffort: options.reasoningEffort ?? null }) + "\\n")
  return {
    languageModel(modelId) {
      return {
        specificationVersion: "v3",
        provider: "effort-probe",
        modelId,
        supportedUrls: {},
        async doStream() {
          return {
            stream: new ReadableStream({
              start(controller) {
                controller.enqueue({ type: "stream-start", warnings: [] })
                controller.enqueue({ type: "text-start", id: "1" })
                controller.enqueue({ type: "text-delta", id: "1", delta: "ok" })
                controller.enqueue({ type: "text-end", id: "1" })
                controller.enqueue({
                  type: "finish",
                  finishReason: { unified: "stop", raw: "stop" },
                  usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } },
                })
                controller.close()
              },
            }),
          }
        },
      }
    },
  }
}
`

function parseArgs(argv: string[]): { model?: string; levels: string[] } {
  return {
    model: argv.find((arg) => arg.startsWith("--model="))?.slice("--model=".length),
    levels: argv.filter((arg) => arg.startsWith("--level=")).map((arg) => arg.slice("--level=".length)),
  }
}

function opencodeModelID(id: string): string {
  const slashIdx = id.indexOf("/")
  const short = slashIdx >= 0 ? id.slice(slashIdx + 1) : id
  return short.toLowerCase()
}

function runOpencode(dir: string, logPath: string, modelRef: string): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("opencode", ["run", "--standalone", "--model", modelRef, "reasoning effort check"], {
      cwd: dir,
      stdio: ["ignore", "ignore", "pipe"],
      env: { ...process.env, PWD: dir, XDG_CONFIG_HOME: join(dir, "xdg"), CC_EFFORT_LOG: logPath },
    })

    let stderr = ""
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()))

    const timer = setTimeout(() => child.kill("SIGKILL"), RUN_TIMEOUT_MS)
    child.on("error", (error) => {
      clearTimeout(timer)
      resolve({ code: null, stderr: `${stderr}\nspawn error: ${error.message}` })
    })
    child.on("close", (code) => {
      clearTimeout(timer)
      resolve({ code, stderr })
    })
  })
}

function readEfforts(logPath: string): Array<string | null> {
  try {
    return readFileSync(logPath, "utf-8")
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => JSON.parse(line).reasoningEffort as string | null)
  } catch {
    return []
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const modelID = args.model ?? DEFAULT_MODEL
  const models: ModelEntry[] = JSON.parse(readFileSync(join(ROOT, "models.json"), "utf-8"))
  const entry = models.find((model) => model.id === modelID)

  if (!entry) {
    console.error(`Model not found in models.json: ${modelID}`)
    process.exit(1)
  }

  const levels = args.levels.length > 0 ? args.levels : entry.reasoning_efforts ?? []
  if (levels.length === 0) {
    console.error(`${modelID} does not declare reasoning efforts in models.json`)
    process.exit(1)
  }

  const configKey = opencodeModelID(entry.id)
  const dir = mkdtempSync(join(tmpdir(), "cc-effort-"))
  const logPath = join(dir, "effort.jsonl")
  const probeDir = join(dir, "probe")

  mkdirSync(probeDir, { recursive: true })
  mkdirSync(join(dir, "xdg"), { recursive: true })
  writeFileSync(join(probeDir, "index.ts"), PROBE_PACKAGE, "utf-8")
  writeFileSync(logPath, "", "utf-8")
  writeFileSync(
    join(dir, "opencode.json"),
    JSON.stringify(
      {
        $schema: "https://opencode.ai/config.json",
        plugins: [
          {
            package: ROOT,
            options: { providerPackage: `aisdk:file://${probeDir}` },
          },
        ],
        model: `commandcode/${configKey}`,
      },
      null,
      2,
    ) + "\n",
    "utf-8",
  )

  console.log(`Verifying ${entry.id} (${levels.join(", ")}) with an isolated probe\n`)

  let failed = 0
  try {
    for (const level of levels) {
      const before = readEfforts(logPath).length
      const result = await runOpencode(dir, logPath, `commandcode/${configKey}#${level}`)
      await new Promise((resolve) => setTimeout(resolve, 200))

      const observed = readEfforts(logPath).slice(before)
      const ok = result.code === 0 && observed.includes(level)

      if (ok) {
        console.log(`  PASS  #${level.padEnd(6)} -> provider received reasoningEffort="${level}"`)
      } else {
        failed += 1
        const detail = observed.length === 0 ? "provider never ran" : `received ${JSON.stringify(observed)}`
        console.error(`  FAIL  #${level.padEnd(6)} -> ${detail} (exit=${result.code})`)
        if (result.stderr.trim()) console.error(result.stderr.trim().split("\n").slice(-6).join("\n"))
      }
    }
  } finally {
    if (process.env.CC_KEEP) console.log(`\nKept temp dir: ${dir}`)
    else rmSync(dir, { recursive: true, force: true })
  }

  if (failed > 0) {
    console.error(`\n${failed} level(s) failed. Check that the plugin loads from ${ROOT} and that OpenCode is up to date.`)
    process.exit(1)
  }

  console.log("\nEvery level reached the provider as reasoningEffort.")
}

main()
