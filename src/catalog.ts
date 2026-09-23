import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

export interface ModelEntry {
  id: string
  name: string
  tier: "premium" | "open-source"
  reasoning: boolean
  tool_call: boolean
  cost: { input: number; output: number; cache_read?: number; cache_write?: number }
  limit: { context: number; output: number }
}

export function loadModels(): ModelEntry[] {
  const modelsPath = join(__dirname, "..", "models.json")
  return JSON.parse(readFileSync(modelsPath, "utf-8"))
}

export function toConfigKey(id: string): string {
  const slashIdx = id.indexOf("/")
  const short = slashIdx >= 0 ? id.slice(slashIdx + 1) : id
  return short.toLowerCase()
}
