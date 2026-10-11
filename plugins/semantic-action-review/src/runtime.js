import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { JsonlAuditSink } from "./audit-sink.js";
import { normalizeBeforeToolCall } from "./normalizer.js";
import { resultShape } from "./redaction.js";

export function createSarRuntime({ config = {}, logger = console, processSalt = randomBytes(32).toString("hex") } = {}) {
  const enabled = config.enabled !== false;
  const includeReads = config.includeReads === true;
  const auditPath = config.auditPath ?? join(homedir(), ".openclaw", "audit", "sar-shadow.jsonl");
  const sink = new JsonlAuditSink(auditPath);
  const pending = new Map();
  const write = (record) => sink.append(record).catch((error) => logger.error?.(`SAR shadow audit failed: ${error.message}`));

  return {
    auditPath,
    async before(event, ctx) {
      if (!enabled) return;
      const key = event.toolCallId ?? `${event.runId ?? ctx.runId ?? "run"}:${event.toolName}`;
      // OpenClaw can expose both a gateway wrapper and its inner tool through
      // the same hook with the same tool-call id. Treat that as one effect.
      if (pending.has(key)) return undefined;
      const record = normalizeBeforeToolCall(event, ctx, { processSalt });
      if (!includeReads && !record.tool.classification.consequential) return;
      pending.set(key, { eventId: record.eventId, proposedToolName: record.tool.name, startedAt: Date.now() });
      if (pending.size > 10_000) pending.delete(pending.keys().next().value);
      await write(record);
      return undefined;
    },
    async after(event, ctx) {
      if (!enabled) return;
      const key = event.toolCallId ?? `${event.runId ?? ctx.runId ?? "run"}:${event.toolName}`;
      const proposal = pending.get(key);
      if (!proposal) return;
      pending.delete(key);
      await write({
        schemaVersion: 2,
        recordType: "actual_effect",
        timestamp: new Date().toISOString(),
        eventId: proposal.eventId,
        mode: "shadow",
        enforced: false,
        tool: {
          name: proposal.proposedToolName,
          observedName: event.toolName,
          nameChanged: proposal.proposedToolName !== event.toolName,
        },
        result: {
          status: event.error ? "error" : "completed",
          durationMs: Number.isFinite(event.durationMs) ? event.durationMs : Date.now() - proposal.startedAt,
          shape: resultShape(event.result),
          errorPresent: Boolean(event.error),
        },
      });
    },
  };
}
