import { resolveApiKey } from "./src/auth.js"
import { CommandCodeLanguageModel } from "./src/model.js"

export interface CommandCodeProviderOptions {
  name?: string
  apiKey?: string
  baseURL?: string
  headers?: Record<string, string>
  /** Reasoning effort sent as `reasoning_effort` (for example "low", "high", or "max"). */
  reasoningEffort?: string
}

export function createCommandCode(options: CommandCodeProviderOptions = {}) {
  const apiKey = resolveApiKey({ apiKey: options.apiKey })
  if (!apiKey) {
    throw new Error(
      "Command Code API key not found. Set COMMANDCODE_API_KEY env var, create ~/.commandcode/auth.json, or pass apiKey option.",
    )
  }

  return {
    languageModel(modelId: string): CommandCodeLanguageModel {
      return new CommandCodeLanguageModel(modelId, {
        apiKey,
        baseURL: typeof options.baseURL === "string" ? options.baseURL : undefined,
        headers: typeof options.headers === "object" && options.headers !== null ? options.headers as Record<string, string> : undefined,
        reasoningEffort: typeof options.reasoningEffort === "string" ? options.reasoningEffort : undefined,
      })
    },
  }
}
