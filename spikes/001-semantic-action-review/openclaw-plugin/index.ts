// Illustrative adapter only. This spike is deliberately not installed.
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

export default function register(api: OpenClawPluginApi) {
  api.on("before_tool_call", async (event, ctx) => {
    const proposedEffect = {
      schemaVersion: 1,
      id: event.toolCallId ?? crypto.randomUUID(),
      actor: { id: ctx.agentId ?? "unknown", type: "agent" },
      request: { source: ctx.sessionKey ?? "unknown", instruction: "REDACTED_OR_BOUND_REQUEST" },
      operation: { kind: "connector_write", tool: event.toolName, action: event.toolName, target: "NORMALIZED_TARGET", parameters: event.params },
      recipients: [], dataClasses: [], reversibility: "partially_reversible",
      authorization: { structuralAllowed: true }, expectedResult: "NORMALIZED_EXPECTED_RESULT",
      ruleSet: { version: "CURRENT_RULESET_VERSION", rules: [] }, riskSignals: [],
      idempotencyKey: event.toolCallId ?? crypto.randomUUID()
    };
    // enqueueShadowReview(proposedEffect); // non-blocking, redacted audit sink
    void proposedEffect;
    return {}; // shadow mode never blocks, rewrites parameters, or requests approval
  });

  api.on("after_tool_call", async (event) => {
    // correlateActualEffect(event.toolCallId, event.result, event.error);
    void event;
  });
}
