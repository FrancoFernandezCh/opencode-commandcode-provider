import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "fs"
import { join } from "path"
import { homedir } from "os"
import { execSync } from "child_process"

const PROJECT_ROOT = join(import.meta.dir, "..")
const MODELS_JSON = join(PROJECT_ROOT, "models.json")
const GLOBAL_CONFIG = join(homedir(), ".config", "opencode", "opencode.jsonc")
const NPM_PACKAGE = "command-code"
const TMP_DIR = join("/tmp", "cc-model-sync")

interface ModelEntry {
  id: string
  name: string
  tier: "premium" | "open-source"
  reasoning: boolean
  tool_call: boolean
  cost: { input: number; output: number; cache_read?: number; cache_write?: number }
  limit: { context: number; output: number }
}

interface CostEntry {
  id: string
  provider: string
  category: string
  promptCost: number
  completionCost: number
  cacheWrite5mCost: number
  cacheWrite1hCost: number
  cacheHitCost: number
}

interface SnEntry {
  id: string
  provider: string
  spec: string
  label: string
  name: string
  description: string
  reasoning?: boolean
  reasoningEfforts?: string[]
  contextWindow?: number
  maxOutputTokens?: number
  hidden?: boolean
}

interface GatewayPricingEntry {
  canonicalId: string
  order: string[]
  providers: Record<string, { promptCost: number; completionCost: number; cacheReadCost: number; cacheWriteCost?: number }>
}

interface OpenRouterPricingEntry {
  canonicalId: string
  order: string[]
  providers: Record<string, { promptCost: number; completionCost: number; cacheReadCost: number }>
}

interface SimplePricingEntry {
  canonicalId: string
  promptCost: number
  completionCost: number
  cacheReadCost?: number
}

const FALLBACK_COSTS: Record<string, { input: number; output: number; cache_read?: number; cache_write?: number }> = {
  "deepseek/deepseek-v4-pro": { input: 0.435, output: 0.87, cache_read: 0.003625 },
  "deepseek/deepseek-v4-flash": { input: 0.14, output: 0.28, cache_read: 0.01 },
  "zai-org/GLM-5.1": { input: 1.4, output: 4.4, cache_read: 0.26 },
  "MiniMaxAI/MiniMax-M2.7": { input: 0.3, output: 1.2, cache_read: 0.06 },
  "Qwen/Qwen3.6-Max-Preview": { input: 1.3, output: 7.8, cache_read: 0.26, cache_write: 1.63 },
  "Qwen/Qwen3.6-Plus": { input: 0.5, output: 3, cache_read: 0.1 },
  "Qwen/Qwen3.7-Max": { input: 1.25, output: 3.75, cache_read: 0.25, cache_write: 1.56 },
  "stepfun/Step-3.5-Flash": { input: 0.1, output: 0.3, cache_read: 0.02 },
  "google/gemini-3.5-flash": { input: 1.5, output: 9, cache_read: 0.15 },
  "google/gemini-3.1-flash-lite": { input: 0.25, output: 1.5, cache_read: 0.03 },
}

const FALLBACK_LIMITS: Record<string, { context: number; output: number }> = {
  "claude-haiku-4-5-20251001": { context: 200000, output: 8192 },
  "claude-opus-4-6": { context: 200000, output: 32000 },
  "claude-opus-4-7": { context: 200000, output: 32000 },
  "claude-sonnet-4-6": { context: 200000, output: 16000 },
  "gpt-5.5": { context: 256000, output: 128000 },
  "gpt-5.4": { context: 256000, output: 128000 },
  "gpt-5.3-codex": { context: 256000, output: 128000 },
  "gpt-5.4-mini": { context: 256000, output: 128000 },
  "moonshotai/Kimi-K2.6": { context: 262144, output: 131072 },
  "moonshotai/Kimi-K2.5": { context: 262144, output: 131072 },
  "zai-org/GLM-5": { context: 200000, output: 131072 },
  "zai-org/GLM-5.1": { context: 200000, output: 131072 },
  "MiniMaxAI/MiniMax-M2.5": { context: 1000000, output: 131072 },
  "MiniMaxAI/MiniMax-M2.7": { context: 1000000, output: 131072 },
  "deepseek/deepseek-v4-pro": { context: 1000000, output: 384000 },
  "deepseek/deepseek-v4-flash": { context: 1000000, output: 384000 },
  "Qwen/Qwen3.6-Max-Preview": { context: 1000000, output: 131072 },
  "Qwen/Qwen3.6-Plus": { context: 1000000, output: 131072 },
  "Qwen/Qwen3.7-Max": { context: 1000000, output: 131072 },
  "stepfun/Step-3.5-Flash": { context: 1000000, output: 131072 },
  "google/gemini-3.5-flash": { context: 1000000, output: 65536 },
  "google/gemini-3.1-flash-lite": { context: 1000000, output: 65536 },
}

const TIER_MAP: Record<string, "premium" | "open-source"> = {
  "anthropic": "premium",
  "openai": "premium",
  "baseten": "open-source",
  "vercel-ai-gateway": "open-source",
  "openrouter": "open-source",
  "cloudflare-ai-gateway": "open-source",
  "novita": "open-source",
  "alibaba": "open-source",
  "morph": "open-source",
  "cmd-ai": "open-source",
}

async function fetchLatestBundle(): Promise<{ source: string; version: string }> {
  console.log(`Fetching latest ${NPM_PACKAGE} metadata...`)
  const metaResp = await fetch(`https://registry.npmjs.org/${NPM_PACKAGE}/latest`)
  if (!metaResp.ok) throw new Error(`npm registry returned ${metaResp.status}`)
  const meta = await metaResp.json()
  const version = meta.version as string
  const tarball = meta.dist.tarball as string
  console.log(`  Latest version: ${version}`)
  console.log(`  Tarball: ${tarball}`)

  mkdirSync(TMP_DIR, { recursive: true })
  const tgzPath = join(TMP_DIR, `${NPM_PACKAGE}.tgz`)

  console.log("Downloading tarball...")
  const tarballResp = await fetch(tarball)
  if (!tarballResp.ok) throw new Error(`tarball download returned ${tarballResp.status}`)
  const buffer = Buffer.from(await tarballResp.arrayBuffer())
  writeFileSync(tgzPath, buffer)

  console.log("Extracting...")
  execSync(`tar -xzf "${tgzPath}" -C "${TMP_DIR}"`, { stdio: "pipe" })

  const distDir = join(TMP_DIR, "package", "dist")
  const candidates = ["cli.mjs", "index.mjs"]
  let bundlePath: string | undefined
  for (const candidate of candidates) {
    const p = join(distDir, candidate)
    if (existsSync(p)) {
      bundlePath = p
      break
    }
  }
  if (!bundlePath) throw new Error(`Bundle not found in ${distDir} (tried ${candidates.join(", ")})`)

  const source = readFileSync(bundlePath, "utf-8")

  rmSync(TMP_DIR, { recursive: true, force: true })

  return { source, version }
}

function findBalancedAt(source: string, anchor: string, open: string, close: string): string {
  const anchorIdx = source.indexOf(anchor)
  if (anchorIdx < 0) throw new Error(`Anchor not found: ${anchor}`)

  const start = source.indexOf(open, anchorIdx)
  if (start < 0) throw new Error(`No ${open} found after anchor: ${anchor}`)

  let depth = 0
  let end = start
  for (; end < source.length; end++) {
    if (source[end] === open) depth++
    else if (source[end] === close) {
      depth--
      if (depth === 0) break
    }
  }
  if (depth !== 0) throw new Error(`Unbalanced ${open} after anchor: ${anchor}`)

  return source.slice(start, end + 1)
}

function evaluateWithContext(code: string, context: Record<string, unknown>): any {
  const keys = Object.keys(context)
  const values = keys.map((k) => context[k])
  const fn = Function(...keys, `"use strict"; return (${code})`)
  return fn(...values)
}

function normalizeForEval(code: string): string {
  return code
    .replace(/!0/g, "true")
    .replace(/!1/g, "false")
    .replace(/(\d+)e(\d+)/g, (_: string, m: string, e: string) =>
      String(Number(m) * Math.pow(10, Number(e)))
    )
    .replace(/get\s+hidden\s*\(\s*\)\s*\{[^}]*\}/g, "hidden: true")
}

function extractProviderConstants(source: string): Record<string, string> {
  const start = source.indexOf('var FA="anthropic"')
  if (start < 0) throw new Error("Could not find provider constants (var FA=...)")

  const yaIdx = source.indexOf("YA={", start)
  if (yaIdx < 0) throw new Error("Could not find cost object (YA=)")

  const block = source.slice(start, yaIdx)
  const consts: Record<string, string> = {}
  for (const m of block.matchAll(/([A-Za-z_$]+)="([^"]+)"/g)) consts[m[1]] = m[2]

  const alias = block.match(/KA=([A-Za-z_$]+)/)
  if (alias && consts[alias[1]]) consts.KA = consts[alias[1]]

  return consts
}

function extractSpecConstants(source: string): Record<string, string> {
  const start = source.indexOf('var JA="chatComplete"')
  if (start < 0) throw new Error("Could not find spec constants (var JA=...)")

  const zaIdx = source.indexOf("ZA={", start)
  if (zaIdx < 0) throw new Error("Could not find model catalog (ZA=)")

  const block = source.slice(start, zaIdx)
  const out: Record<string, string> = {}
  for (const m of block.matchAll(/([A-Za-z_$]+)="([^"]+)"/g)) out[m[1]] = m[2]
  return out
}

function extractModelCatalog(source: string, consts: Record<string, string>): Record<string, SnEntry> {
  const raw = findBalancedAt(source, "ZA={", "{", "}")
  return evaluateWithContext(normalizeForEval(raw), consts)
}

function extractCostData(source: string, consts: Record<string, string>): {
  ya: Record<string, CostEntry[]>
  tR: GatewayPricingEntry[]
  oR: OpenRouterPricingEntry[]
  nR: SimplePricingEntry[]
  rR: SimplePricingEntry[]
} {
  const yaRaw = findBalancedAt(source, "YA={", "{", "}")
  const ya = evaluateWithContext(normalizeForEval(yaRaw), consts) as Record<string, CostEntry[]>

  const tR = evaluateWithContext(
    normalizeForEval(findBalancedAt(source, "tR=[", "[", "]")),
    consts,
  ) as GatewayPricingEntry[]

  const oR = evaluateWithContext(
    normalizeForEval(findBalancedAt(source, "oR=[", "[", "]")),
    consts,
  ) as OpenRouterPricingEntry[]

  const nR = evaluateWithContext(
    normalizeForEval(findBalancedAt(source, "nR=[", "[", "]")),
    consts,
  ) as SimplePricingEntry[]

  const rR = evaluateWithContext(
    normalizeForEval(findBalancedAt(source, "rR=[", "[", "]")),
    consts,
  ) as SimplePricingEntry[]

  return { ya, tR, oR, nR, rR }
}

function stripProviderPrefix(id: string): string {
  const colonIdx = id.indexOf(":")
  return colonIdx >= 0 ? id.slice(colonIdx + 1) : id
}

function findDirectCost(id: string, ya: Record<string, CostEntry[]>): CostEntry | undefined {
  for (const arr of Object.values(ya)) {
    const entry = arr.find((e) => stripProviderPrefix(e.id) === id)
    if (entry) return entry
  }
  return undefined
}

function resolveCost(id: string, data: ReturnType<typeof extractCostData>): {
  input: number
  output: number
  cache_read?: number
  cache_write?: number
} | null {
  const direct = findDirectCost(id, data.ya)
  if (direct) {
    return {
      input: direct.promptCost,
      output: direct.completionCost,
      cache_read: direct.cacheHitCost > 0 ? direct.cacheHitCost : undefined,
      cache_write: direct.cacheWrite5mCost > 0 ? direct.cacheWrite5mCost : undefined,
    }
  }

  const gateway = data.tR.find((e) => e.canonicalId === id)
  if (gateway) {
    const primary = gateway.providers[gateway.order[0]]
    if (primary) {
      return {
        input: primary.promptCost,
        output: primary.completionCost,
        cache_read: primary.cacheReadCost > 0 ? primary.cacheReadCost : undefined,
        cache_write: primary.cacheWriteCost && primary.cacheWriteCost > 0 ? primary.cacheWriteCost : undefined,
      }
    }
  }

  const openrouter = data.oR.find((e) => e.canonicalId === id)
  if (openrouter) {
    const primary = openrouter.providers[openrouter.order[0]]
    if (primary) {
      return {
        input: primary.promptCost,
        output: primary.completionCost,
        cache_read: primary.cacheReadCost > 0 ? primary.cacheReadCost : undefined,
      }
    }
  }

  const alibaba = data.nR.find((e) => e.canonicalId === id)
  if (alibaba) {
    return {
      input: alibaba.promptCost,
      output: alibaba.completionCost,
      cache_read: alibaba.cacheReadCost && alibaba.cacheReadCost > 0 ? alibaba.cacheReadCost : undefined,
    }
  }

  const morph = data.rR.find((e) => e.canonicalId === id)
  if (morph) {
    return {
      input: morph.promptCost,
      output: morph.completionCost,
      cache_read: morph.cacheReadCost && morph.cacheReadCost > 0 ? morph.cacheReadCost : undefined,
    }
  }

  return null
}

function tierFor(id: string, provider: string, data: ReturnType<typeof extractCostData>): "premium" | "open-source" {
  const direct = findDirectCost(id, data.ya)
  if (direct) return direct.category === "premium" ? "premium" : "open-source"
  return TIER_MAP[provider] ?? "open-source"
}

function buildModelEntry(
  entry: SnEntry,
  data: ReturnType<typeof extractCostData>,
): ModelEntry | null {
  const cost = resolveCost(entry.id, data) ?? FALLBACK_COSTS[entry.id]
  if (!cost) return null

  const limit = {
    context: entry.contextWindow ?? FALLBACK_LIMITS[entry.id]?.context ?? 200000,
    output: entry.maxOutputTokens ?? FALLBACK_LIMITS[entry.id]?.output ?? 65536,
  }

  return {
    id: entry.id,
    name: entry.name,
    tier: tierFor(entry.id, entry.provider, data),
    reasoning: entry.reasoning || (entry.reasoningEfforts?.length ?? 0) > 0,
    tool_call: true,
    cost,
    limit,
  }
}

function toConfigKey(id: string): string {
  const slashIdx = id.indexOf("/")
  const short = slashIdx >= 0 ? id.slice(slashIdx + 1) : id
  return short.toLowerCase()
}

function generateOpencodeModels(entries: ModelEntry[]): Record<string, unknown> {
  const models: Record<string, unknown> = {}
  for (const entry of entries) {
    const key = toConfigKey(entry.id)
    const costObj: Record<string, number> = { input: entry.cost.input, output: entry.cost.output }
    if (entry.cost.cache_read !== undefined) costObj.cache_read = entry.cost.cache_read
    if (entry.cost.cache_write !== undefined) costObj.cache_write = entry.cost.cache_write

    models[key] = {
      id: entry.id,
      name: entry.name,
      reasoning: entry.reasoning,
      tool_call: entry.tool_call,
      cost: costObj,
      limit: entry.limit,
    }
  }
  return models
}

function stripJsonc(input: string): string {
  let out = ""
  let i = 0
  while (i < input.length) {
    const ch = input[i]
    if (ch === '"') {
      const start = i
      i++
      while (i < input.length && input[i] !== '"') {
        if (input[i] === "\\") i++
        i++
      }
      i++
      out += input.slice(start, i)
    } else if (ch === "/" && input[i + 1] === "/") {
      while (i < input.length && input[i] !== "\n") i++
    } else if (ch === "/" && input[i + 1] === "*") {
      i += 2
      while (i < input.length && !(input[i] === "*" && input[i + 1] === "/")) i++
      i += 2
    } else {
      out += ch
      i++
    }
  }
  return out.replace(/,\s*([}\]])/g, "$1")
}

function updateGlobalConfig(modelsObj: Record<string, unknown>) {
  if (!existsSync(GLOBAL_CONFIG)) {
    console.log(`  Global config not found at ${GLOBAL_CONFIG}, skipping`)
    return
  }

  const raw = readFileSync(GLOBAL_CONFIG, "utf-8")
  const jsonStr = stripJsonc(raw)

  let config: any
  try {
    config = JSON.parse(jsonStr)
  } catch {
    console.error("  Failed to parse global config as JSON after stripping comments")
    return
  }

  if (!config.provider) config.provider = {}
  if (!config.provider.commandcode) {
    config.provider.commandcode = {
      npm: "commandcode-go-opencode-provider",
      name: "Command Code",
      env: ["COMMANDCODE_API_KEY"],
    }
  }
  config.provider.commandcode.models = modelsObj

  const output = JSON.stringify(config, null, 2) + "\n"
  writeFileSync(GLOBAL_CONFIG, output, "utf-8")
  console.log(`  Updated ${GLOBAL_CONFIG}`)
}

async function main() {
  const args = process.argv.slice(2)
  const shouldUpdateGlobal = args.includes("--update-global")

  const { source, version } = await fetchLatestBundle()
  console.log(`Read CLI bundle v${version} (${(source.length / 1024).toFixed(0)} KB)`)

  console.log("Extracting provider constants...")
  const consts = extractProviderConstants(source)
  Object.assign(consts, extractSpecConstants(source))
  console.log(`  Provider consts: ${Object.keys(consts).join(", ")}`)

  console.log("Extracting cost data...")
  const data = extractCostData(source, consts)
  const directCount = Object.values(data.ya).flat().length
  console.log(`  Direct entries: ${directCount}, gateway: ${data.tR.length}, openrouter: ${data.oR.length}, alibaba: ${data.nR.length}, morph: ${data.rR.length}`)

  console.log("Extracting model catalog...")
  const models = extractModelCatalog(source, consts)
  const modelCount = Object.keys(models).length
  console.log(`  Found ${modelCount} models`)

  const entries: ModelEntry[] = []

  for (const [, model] of Object.entries(models)) {
    if (model.hidden) {
      console.log(`  Skipping hidden model: ${model.id}`)
      continue
    }
    const entry = buildModelEntry(model, data)
    if (entry) {
      entries.push(entry)
    } else {
      console.warn(`  Skipping ${model.id}: no cost data`)
    }
  }

  entries.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier === "premium" ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  console.log(`\nWriting ${MODELS_JSON} with ${entries.length} models...`)
  writeFileSync(MODELS_JSON, JSON.stringify(entries, null, 2) + "\n", "utf-8")

  const modelsObj = generateOpencodeModels(entries)

  if (shouldUpdateGlobal) {
    console.log("Updating global config...")
    updateGlobalConfig(modelsObj)
  }

  console.log("\nModel list:")
  for (const entry of entries) {
    const cost = `$${entry.cost.input}/$${entry.cost.output}`
    console.log(`  ${entry.tier.padEnd(12)} ${entry.id.padEnd(35)} ${entry.name.padEnd(25)} ${cost}`)
  }

  if (!shouldUpdateGlobal) {
    console.log(`\nRun with --update-global to update ${GLOBAL_CONFIG}`)
  }

  console.log("\nDone.")
}

main()
