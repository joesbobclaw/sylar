import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { createSarRuntime } from "./src/runtime.js";

export default definePluginEntry({
  id: "sylar-semantic-action-review",
  name: "Sylar Semantic Action Review",
  description: "Shadow-only, redacted audit telemetry for consequential tool calls",
  register(api) {
    const runtime = createSarRuntime({ config: api.pluginConfig, logger: api.logger });
    api.logger.info(`SAR shadow mode active; redacted audit: ${runtime.auditPath}`);
    api.on("before_tool_call", runtime.before, { priority: -100, timeoutMs: 2_000 });
    api.on("after_tool_call", runtime.after, { priority: -100, timeoutMs: 2_000 });
  },
});
