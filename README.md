# commandcode-go-opencode-provider

[Command Code](https://commandcode.ai) API provider for [OpenCode](https://opencode.ai). Use Claude, GPT, Gemini, DeepSeek, Qwen, Kimi, GLM, MiniMax, Step, and other models through a single API key.

## OpenCode V2

Add the plugin to your `opencode.json` or `opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["commandcode-go-opencode-provider"],
  "model": "commandcode/deepseek-v4-flash"
}
```

The plugin registers the Command Code provider and the models from [`models.json`](./models.json).

Connect your account in OpenCode:

```
/connect
```

Search for **Command Code** and enter your API key, then pick a model from `/models`:

```
/models
```

Set `COMMANDCODE_API_KEY` on the OpenCode server instead of saving a key with `/connect`:

```bash
COMMANDCODE_API_KEY=your-key opencode
```

## OpenCode V1 compatibility

The same `/server` entrypoint also works in OpenCode 1.18.29 and newer. V1 users can keep their existing provider setup:

```json
{
  "plugin": ["commandcode-go-opencode-provider/server"],
  "provider": {
    "commandcode": {
      "npm": "commandcode-go-opencode-provider",
      "name": "Command Code",
      "env": ["COMMANDCODE_API_KEY"]
    }
  },
  "model": "commandcode/deepseek-v4-flash"
}
```

The V1 plugin auto-registers models from `models.json` and retains its existing `/connect` flow. On older V1 releases that do not support shared entrypoints, pin `commandcode-go-opencode-provider@0.4.0`.

## Reasoning effort

Models with reasoning support expose their accepted effort levels as variants. Append `#level` to the model reference:

```bash
opencode run --model commandcode/deepseek-v4-flash#high "Refactor parseToken"
```

The same syntax works anywhere a model is selected, including agents and commands:

```jsonc
{
  "agents": {
    "build": {
      "model": "commandcode/claude-opus-5-5#xhigh"
    }
  }
}
```

Available levels per model are listed in the [table below](#available-models). Models without levels ignore the setting.

## Available Models

| Model ID | Name | Tier | Reasoning | Efforts | Context |
|---|---|---|---|---|---|
| `claude-fable-5`                           | Claude Fable 5              | premium      | yes | low, medium, high, xhigh, max | 1M     |
| `claude-fable-5-1`                         | Claude Fable 5.1            | premium      | yes | low, medium, high, xhigh, max | 1M     |
| `claude-haiku-4-5-20251001`                | Claude Haiku 4.5            | premium      | no  | —                            | 200K   |
| `claude-opus-4-7`                          | Claude Opus 4.7             | premium      | yes | low, medium, high, xhigh, max | 1M     |
| `claude-opus-4-8`                          | Claude Opus 4.8             | premium      | yes | low, medium, high, xhigh, max | 1M     |
| `claude-opus-5`                            | Claude Opus 5               | premium      | yes | low, medium, high, xhigh, max | 1M     |
| `claude-opus-5-5`                          | Claude Opus 5.5             | premium      | yes | low, medium, high, xhigh, max | 1M     |
| `claude-sonnet-4-6`                        | Claude Sonnet 4.6           | premium      | yes | low, medium, high, xhigh, max | 1M     |
| `claude-sonnet-5`                          | Claude Sonnet 5             | premium      | yes | low, medium, high, xhigh, max | 1M     |
| `gpt-5.3-codex`                            | GPT-5.3 Codex               | premium      | yes | low, medium, high, xhigh     | 400K   |
| `gpt-5.4`                                  | GPT-5.4                     | premium      | yes | low, medium, high, xhigh     | 400K   |
| `gpt-5.4-mini`                             | GPT-5.4 Mini                | premium      | yes | low, medium, high            | 400K   |
| `gpt-5.5`                                  | GPT-5.5                     | premium      | yes | low, medium, high, xhigh     | 400K   |
| `gpt-5.6-luna`                             | GPT-5.6 Luna                | premium      | yes | low, medium, high, xhigh, max | 1M     |
| `gpt-5.6-sol`                              | GPT-5.6 Sol                 | premium      | yes | low, medium, high, xhigh, max | 1M     |
| `gpt-5.6-terra`                            | GPT-5.6 Terra               | premium      | yes | low, medium, high, xhigh, max | 1M     |
| `gpt-6-astra`                              | GPT-6 Astra                 | premium      | yes | low, medium, high, xhigh, max | 1M     |
| `gpt-6-sol`                                | GPT-6 Sol                   | premium      | yes | low, medium, high, xhigh, max | 1M     |
| `deepseek/deepseek-v4-flash`               | DeepSeek V4 Flash (latest)  | open-source  | yes | high, max                    | 1M     |
| `deepseek/deepseek-v4-flash-fast`          | DeepSeek V4 Flash Fast      | open-source  | yes | low, high, max               | 1M     |
| `deepseek/deepseek-v4-flash-vision-exp`    | DeepSeek V4 Flash Vision (exp) | open-source  | yes | high, max                    | 1M     |
| `deepseek/deepseek-v4-pro`                 | DeepSeek V4 Pro (latest)    | open-source  | yes | high, max                    | 1M     |
| `deepseek/deepseek-v4.1-flash`             | DeepSeek V4.1 Flash         | open-source  | yes | low, high, max               | 1M     |
| `sakana/fugu-ultra`                        | Fugu Ultra                  | open-source  | yes | high, xhigh                  | 1M     |
| `google/gemini-3.1-flash-lite`             | Gemini 3.1 Flash Lite       | open-source  | yes | low, medium, high            | 1M     |
| `google/gemini-3.5-flash`                  | Gemini 3.5 Flash            | open-source  | yes | low, medium, high            | 1M     |
| `google/gemini-3.5-flash-lite`             | Gemini 3.5 Flash Lite       | open-source  | yes | low, medium, high            | 1M     |
| `google/gemini-3.6-flash`                  | Gemini 3.6 Flash            | open-source  | yes | low, medium, high            | 1M     |
| `google/gemini-3.7-flash`                  | Gemini 3.7 Flash            | open-source  | yes | low, medium, high            | 1M     |
| `google/gemini-3.8-flash`                  | Gemini 3.8 Flash            | open-source  | yes | low, medium, high            | 1M     |
| `zai-org/GLM-5`                            | GLM-5                       | open-source  | no  | —                            | 200K   |
| `zai-org/GLM-5.1`                          | GLM-5.1                     | open-source  | no  | —                            | 200K   |
| `zai-org/GLM-5.2`                          | GLM-5.2                     | open-source  | yes | high, max                    | 1M     |
| `zai-org/GLM-5.2-Fast`                     | GLM-5.2 Fast                | open-source  | no  | —                            | 1M     |
| `zai-org/GLM-5.3`                          | GLM-5.3                     | open-source  | yes | low, high, max               | 1M     |
| `z-ai/glm-5.3-flash`                       | GLM-5.3 Flash               | open-source  | yes | low, high, max               | 1M     |
| `z-ai/glm-5.3-flashx`                      | GLM-5.3 FlashX              | open-source  | yes | low, high, max               | 1M     |
| `gpt-6-luna`                               | GPT-6 Luna                  | open-source  | yes | low, medium, high, xhigh, max | 1M     |
| `xai/grok-4.5`                             | Grok 4.5                    | open-source  | yes | low, medium, high            | 500K   |
| `xai/grok-4.6`                             | Grok 4.6                    | open-source  | yes | low, medium, high, xhigh     | 500K   |
| `xai/grok-4.7`                             | Grok 4.7                    | open-source  | yes | low, medium, high, xhigh     | 500K   |
| `thinkingmachines/inkling`                 | Inkling                     | open-source  | yes | —                            | 256K   |
| `thinkingmachines/inkling-small`           | Inkling Small               | open-source  | yes | —                            | 1M     |
| `moonshotai/Kimi-K2.5`                     | Kimi K2.5                   | open-source  | no  | —                            | 256K   |
| `moonshotai/Kimi-K2.6`                     | Kimi K2.6                   | open-source  | no  | —                            | 256K   |
| `moonshotai/Kimi-K2.7-Code`                | Kimi K2.7 Code              | open-source  | yes | —                            | 256K   |
| `moonshotai/Kimi-K2.7-Code-Highspeed`      | Kimi K2.7 Code HighSpeed    | open-source  | yes | —                            | 262K   |
| `moonshotai/Kimi-K3`                       | Kimi K3                     | open-source  | yes | low, high, max               | 1M     |
| `poolside/laguna-s-2.1-free`               | Laguna S 2.1 (free)         | open-source  | yes | —                            | 256K   |
| `inclusionai/ling-3.0-flash-sante:free`    | Ling 3.0 Flash Sante (free) | open-source  | yes | —                            | 262K   |
| `meituan/LongCat-2.0`                      | LongCat 2.0                 | open-source  | yes | —                            | 1M     |
| `xiaomi/mimo-v2.5`                         | MiMo V2.5                   | open-source  | no  | —                            | 1M     |
| `xiaomi/mimo-v2.5-pro`                     | MiMo V2.5 Pro               | open-source  | no  | —                            | 1M     |
| `xiaomi/mimo-v2.6-flash`                   | MiMo V2.6 Flash             | open-source  | no  | —                            | 1M     |
| `xiaomi/mimo-v2.6-pro`                     | MiMo V2.6 Pro               | open-source  | no  | —                            | 1M     |
| `xiaomi/mimo-v2.6-pro-ultraspeed`          | MiMo V2.6 Pro UltraSpeed    | open-source  | no  | —                            | 1M     |
| `MiniMaxAI/MiniMax-M2.5`                   | MiniMax M2.5                | open-source  | no  | —                            | 200K   |
| `MiniMaxAI/MiniMax-M2.7`                   | MiniMax M2.7                | open-source  | no  | —                            | 1M     |
| `minimax/minimax-m2.7-free`                | MiniMax M2.7 (free)         | open-source  | no  | —                            | 197K   |
| `MiniMaxAI/MiniMax-M3`                     | MiniMax M3                  | open-source  | yes | low, medium, high            | 1M     |
| `MiniMaxAI/MiniMax-M3-Free`                | MiniMax M3 (free)           | open-source  | yes | low, medium, high            | 1M     |
| `minimax/minimax-m3-free`                  | MiniMax M3 (free)           | open-source  | yes | low, medium, high            | 1M     |
| `meta/muse-spark-1.1`                      | Muse Spark 1.1              | open-source  | yes | low, medium, high, xhigh     | 1M     |
| `meta/muse-spark-1.2`                      | Muse Spark 1.2              | open-source  | yes | low, medium, high, xhigh     | 1M     |
| `meta/muse-spark-1.2-contributor`          | Muse Spark 1.2 Contributor  | open-source  | yes | low, medium, high, xhigh     | 1M     |
| `meta/muse-spark-1.3`                      | Muse Spark 1.3              | open-source  | yes | low, medium, high, xhigh, max | 1M     |
| `meta/muse-spark-1.3-contributor`          | Muse Spark 1.3 Contributor  | open-source  | yes | low, medium, high, xhigh     | 1M     |
| `nvidia/nemotron-3-ultra-550b-a55b`        | Nemotron 3 Ultra            | open-source  | yes | —                            | 1M     |
| `stealth/pixel-canary`                     | Pixel Canary (free)         | open-source  | yes | low, medium, xhigh           | 262K   |
| `Qwen/Qwen3.6-Max-Preview`                 | Qwen 3.6 Max Preview        | open-source  | yes | —                            | 1M     |
| `Qwen/Qwen3.6-Plus`                        | Qwen 3.6 Plus               | open-source  | yes | —                            | 1M     |
| `Qwen/Qwen3.7-Flash`                       | Qwen 3.7 Flash              | open-source  | yes | —                            | 1M     |
| `Qwen/Qwen3.7-Max`                         | Qwen 3.7 Max                | open-source  | yes | —                            | 1M     |
| `Qwen/Qwen3.7-Plus`                        | Qwen 3.7 Plus               | open-source  | yes | —                            | 1M     |
| `Qwen/Qwen3.8-27B`                         | Qwen 3.8 27B                | open-source  | yes | low, medium, xhigh           | 262K   |
| `Qwen/Qwen3.8-Flash`                       | Qwen 3.8 Flash              | open-source  | yes | low, medium, xhigh           | 1M     |
| `Qwen/Qwen3.8-Max`                         | Qwen 3.8 Max                | open-source  | yes | low, medium, xhigh           | 1M     |
| `Qwen/Qwen3.8-Max-0902`                    | Qwen 3.8 Max 0902           | open-source  | yes | low, medium, xhigh           | 1M     |
| `Qwen/Qwen3.8-Omni-Flash`                  | Qwen 3.8 Omni Flash         | open-source  | yes | low, medium, xhigh           | 1M     |
| `stealth/space-bunny-alpha`                | Space Bunny Alpha (free)    | open-source  | yes | low, medium, high            | 1M     |
| `stepfun/Step-3.5-Flash`                   | Step 3.5 Flash              | open-source  | yes | —                            | 262K   |
| `stepfun/Step-3.7-Flash`                   | Step 3.7 Flash              | open-source  | yes | —                            | 256K   |
| `stepfun/Step-5-Preview`                   | Step 5 Preview              | open-source  | yes | low, medium, high            | 1M     |
| `tencent/hy3-paid`                         | Tencent Hy3                 | open-source  | yes | —                            | 262K   |
| `tencent/hy4-preview`                      | Tencent Hy4 Preview         | open-source  | yes | low, medium, high            | 1M     |

Full model list is maintained in [`models.json`](./models.json). Run `bun run sync` to refresh from the latest Command Code CLI release on npm.

## Development

```bash
git clone https://github.com/brent-weatherall/commandcode-go-opencode-provider.git
cd commandcode-go-opencode-provider
bun install
```

For local V1 testing, create `opencode.local.json` (gitignored) with `file://` paths:

```json
{
  "plugin": ["file:///path/to/commandcode-go-opencode-provider/server"],
  "provider": {
    "commandcode": {
      "npm": "file:///path/to/commandcode-go-opencode-provider",
      "name": "Command Code (local)",
      "env": ["COMMANDCODE_API_KEY"]
    }
  }
}
```

Run `opencode --config opencode.local.json` to test with your local V1 build.

For local V2 development, point the plugin at the checkout and the AI SDK runtime at the local package:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "/absolute/path/to/commandcode-go-opencode-provider",
      "options": {
        "providerPackage": "aisdk:file:///absolute/path/to/commandcode-go-opencode-provider"
      }
    }
  ],
  "model": "commandcode/deepseek-v4-flash"
}
```

Run `opencode --config opencode.local.json` to test the local V2 plugin and provider. The project's own `opencode.json` only sets the Command Code model defaults, so keep the plugin in your global config or in `opencode.local.json` to avoid loading it twice.

### Sync Models

```bash
bun run sync              # update models.json from Command Code
bun run generate-readme   # refresh the model table in this README
```

The plugin ships `models.json`, so a sync is enough. Reload OpenCode afterwards so the plugin re-registers the refreshed catalog:

```bash
opencode reload
```

### Verify Reasoning Effort

```bash
bun run verify:effort                                 # every level of deepseek-v4-flash
bun run verify:effort --model=claude-opus-5-5         # every level of another model
bun run verify:effort --model=claude-opus-5-5 --level=xhigh
```

The script swaps the provider for a local probe package, runs OpenCode with an isolated config, and reports what the provider received. It does not call the Command Code API.

## License

MIT
