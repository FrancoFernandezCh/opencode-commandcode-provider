import { Integration, Model, Plugin, Provider } from "@opencode/plugin"
import { loadModels, toConfigKey, type ModelEntry } from "../src/catalog.js"

const PROVIDER_ID = "commandcode"
export const PLUGIN_ID = "commandcode-go-opencode-provider"
const PROVIDER_PACKAGE = "aisdk:commandcode-go-opencode-provider"

export type SetupCommandCode = (ctx: Plugin.Context) => Promise<void>

export function buildV2Models(entries: ModelEntry[]): Model.Info[] {
  const providerID = Provider.ID.make(PROVIDER_ID)
  const models = new Map<string, Model.Info>()

  for (const entry of entries) {
    // Two upstream IDs can share an OpenCode model ID (e.g. MiniMaxAI/MiniMax-M3-Free
    // and minimax/minimax-m3-free). Keep the last entry, matching the V1 plugin.
    const modelID = Model.ID.make(toConfigKey(entry.id))
    const defaults = Model.Info.default(providerID, modelID)

    models.set(modelID, {
      ...defaults,
      modelID: Model.ID.make(entry.id),
      name: entry.name,
      capabilities: {
        ...defaults.capabilities,
        tools: entry.tool_call,
      },
      cost: [
        {
          input: entry.cost.input as Model.Cost["input"],
          output: entry.cost.output as Model.Cost["output"],
          cache: {
            read: (entry.cost.cache_read ?? 0) as Model.Cost["cache"]["read"],
            write: (entry.cost.cache_write ?? 0) as Model.Cost["cache"]["write"],
          },
        },
      ],
      limit: {
        context: entry.limit.context,
        output: entry.limit.output,
      },
    })
  }

  return [...models.values()]
}

export async function setupCommandCode(ctx: Plugin.Context): Promise<void> {
  const providerID = Provider.ID.make(PROVIDER_ID)
  const integrationID = Integration.ID.make(PROVIDER_ID)
  const models = buildV2Models(loadModels())
  const providerPackage = typeof ctx.options.providerPackage === "string"
    ? ctx.options.providerPackage
    : PROVIDER_PACKAGE

  await ctx.provider.transform((editor) => {
    editor.add({
      info: {
        ...Provider.Info.empty(providerID),
        name: "Command Code",
        activation: "enabled",
        package: providerPackage,
        integrationID,
      },
      models,
    })
  })

  await ctx.integration.transform((editor) => {
    editor.method.update({
      integrationID,
      method: { type: "key", label: "API Key" },
    })
    editor.method.update({
      integrationID,
      method: { type: "env", names: ["COMMANDCODE_API_KEY"] },
    })
    editor.update(PROVIDER_ID, (integration) => {
      integration.name = "Command Code"
    })
  })
}

export default Plugin.define({
  id: PLUGIN_ID,
  setup: setupCommandCode,
})
