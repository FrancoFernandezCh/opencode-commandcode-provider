import { expect, test } from "bun:test"
import plugin, { buildV2Models } from "../../v2/index.ts"
import serverEntrypoint from "../../server.ts"
import { loadModels, toConfigKey } from "../../src/catalog.js"

test("V2 models preserve OpenCode IDs and upstream model IDs", () => {
  const models = buildV2Models([
    {
      id: "deepseek/deepseek-v4-flash",
      name: "DeepSeek V4 Flash",
      tier: "open-source",
      reasoning: true,
      tool_call: false,
      cost: { input: 0.1, output: 0.2, cache_read: 0.01, cache_write: 0.03 },
      limit: { context: 1_000_000, output: 32_000 },
    },
  ])

  expect(models).toHaveLength(1)
  expect(models[0]).toMatchObject({
    id: "deepseek-v4-flash",
    modelID: "deepseek/deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    capabilities: { tools: false },
    cost: [{ input: 0.1, output: 0.2, cache: { read: 0.01, write: 0.03 } }],
    limit: { context: 1_000_000, output: 32_000 },
  })
})

test("V2 models keep one entry per OpenCode model ID", () => {
  const entry = (id: string, name: string) => ({
    id,
    name,
    tier: "open-source" as const,
    reasoning: false,
    tool_call: true,
    cost: { input: 0, output: 0 },
    limit: { context: 1000, output: 100 },
  })

  const models = buildV2Models([
    entry("MiniMaxAI/MiniMax-M3-Free", "MiniMax M3 (free)"),
    entry("minimax/minimax-m3-free", "MiniMax M3 (Free) (free)"),
  ])

  expect(models).toHaveLength(1)
  expect(models[0]).toMatchObject({
    id: "minimax-m3-free",
    modelID: "minimax/minimax-m3-free",
    name: "MiniMax M3 (Free) (free)",
  })
})

test("V2 models expose reasoning efforts as variants", () => {
  const models = buildV2Models([
    {
      id: "deepseek/deepseek-v4-flash",
      name: "DeepSeek V4 Flash",
      tier: "open-source",
      reasoning: true,
      tool_call: true,
      cost: { input: 0.15, output: 0.6 },
      limit: { context: 1_000_000, output: 32_000 },
      reasoning_efforts: ["high", "max"],
    },
    {
      id: "plain-model",
      name: "Plain Model",
      tier: "open-source",
      reasoning: false,
      tool_call: true,
      cost: { input: 0, output: 0 },
      limit: { context: 1_000, output: 100 },
    },
  ])

  expect(models[0]?.variants).toEqual([
    { id: "high", settings: { reasoningEffort: "high" } },
    { id: "max", settings: { reasoningEffort: "max" } },
  ])
  expect(models[1]?.variants).toEqual([])
})

test("server entrypoint serves OpenCode 2 setup() and OpenCode 1 server()", async () => {
  expect(serverEntrypoint.id).toBe("commandcode-go-opencode-provider")
  expect(typeof serverEntrypoint.setup).toBe("function")
  expect(typeof serverEntrypoint.server).toBe("function")

  const v1Hooks = await serverEntrypoint.server()
  expect(v1Hooks.auth.provider).toBe("commandcode")

  const providers: Array<Record<string, unknown>> = []
  await serverEntrypoint.setup({
    options: {},
    provider: {
      transform: async (callback: (editor: { add: (input: never) => void }) => void) => {
        callback({ add: (input) => providers.push(input as Record<string, unknown>) })
        return { dispose: async () => {} }
      },
    },
    integration: {
      transform: async (callback: (editor: {
        method: { update: () => void }
        update: (id: string, update: (integration: { name: string }) => void) => void
      }) => void) => {
        callback({ method: { update: () => {} }, update: (_id, update) => update({ name: "commandcode" }) })
        return { dispose: async () => {} }
      },
    },
  } as never)

  expect(providers).toHaveLength(1)
})

test("V2 plugin registers provider models and API key methods", async () => {
  const providers: Array<{ info: Record<string, unknown>; models: Array<Record<string, unknown>> }> = []
  const methods: Array<{ integrationID: string; method: Record<string, unknown> }> = []
  let updatedIntegrationName: string | undefined

  await plugin.setup({
    options: {},
    provider: {
      transform: async (callback: (editor: { add: (input: typeof providers[number]) => void }) => void) => {
        callback({ add: (input) => providers.push(input) })
        return { dispose: async () => {} }
      },
    },
    integration: {
      transform: async (callback: (editor: {
        method: { update: (input: typeof methods[number]) => void }
        update: (id: string, update: (integration: { name: string }) => void) => void
      }) => void) => {
        callback({
          method: { update: (input) => methods.push(input) },
          update: (_id, update) => {
            const integration = { name: "commandcode" }
            update(integration)
            updatedIntegrationName = integration.name
          },
        })
        return { dispose: async () => {} }
      },
    },
  } as never)

  expect(providers).toHaveLength(1)
  expect(providers[0]?.info).toMatchObject({
    id: "commandcode",
    name: "Command Code",
    activation: "enabled",
    package: "aisdk:commandcode-go-opencode-provider",
    integrationID: "commandcode",
  })
  const catalog = loadModels()
  const uniqueModelIDs = new Set(catalog.map((entry) => toConfigKey(entry.id)))
  expect(providers[0]?.models).toHaveLength(uniqueModelIDs.size)
  expect(methods).toEqual([
    { integrationID: "commandcode", method: { type: "key", label: "API Key" } },
    { integrationID: "commandcode", method: { type: "env", names: ["COMMANDCODE_API_KEY"] } },
  ])
  expect(updatedIntegrationName).toBe("Command Code")
})
