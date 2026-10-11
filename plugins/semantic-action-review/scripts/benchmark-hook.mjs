#!/usr/bin/env node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { createSarRuntime } from "../src/runtime.js";

const iterations = Number.parseInt(process.argv[2] ?? "200", 10);
if (!Number.isSafeInteger(iterations) || iterations < 1 || iterations > 10_000) throw new Error("iterations must be 1..10000");
const dir = await mkdtemp(join(tmpdir(), "sylar-sar-benchmark-"));
const runtime = createSarRuntime({ config: { auditPath: join(dir, "audit.jsonl") }, processSalt: "benchmark", logger: { error() {} } });
const context = { agentId: "benchmark", runId: "run", sessionId: "session", requester: { channel: "test", senderIsOwner: true, roleIds: [] } };
const durations = [];
try {
  for (let index = 0; index < iterations; index += 1) {
    const start = performance.now();
    await runtime.before({ toolName: "message", toolCallId: `call-${index}`, params: { action: "send", target: "redacted", body: "redacted" } }, context);
    await runtime.after({ toolName: "message", toolCallId: `call-${index}`, result: { ok: true } }, context);
    durations.push(performance.now() - start);
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}
durations.sort((a, b) => a - b);
const at = (fraction) => durations[Math.min(durations.length - 1, Math.floor(durations.length * fraction))];
process.stdout.write(`${JSON.stringify({ iterations, combinedBeforeAfterMs: { p50: at(0.5), p95: at(0.95), max: durations.at(-1) } }, null, 2)}\n`);
