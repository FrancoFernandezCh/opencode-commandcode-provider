import commandcodePlugin from "./plugin.js"
import v2Plugin from "./v2/index.js"

/**
 * Dual entrypoint used by the published package.
 *
 * - OpenCode 2 calls `setup(ctx)`.
 * - OpenCode 1.18.29+ calls `server()` on the same default export.
 */
export default {
  ...v2Plugin,
  server: commandcodePlugin,
}
