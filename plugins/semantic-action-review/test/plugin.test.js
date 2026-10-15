import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { JsonlAuditSink } from "../src/audit-sink.js";
import { EphemeralReviewEnvelopeStore } from "../src/ephemeral-review-envelope.js";
import { classifyToolCall, normalizeBeforeToolCall } from "../src/normalizer.js";
import { containsRawValue } from "../src/redaction.js";
import { createSarRuntime } from "../src/runtime.js";
import { buildShadowReport } from "../src/shadow-report.js";
import { createHookTiming } from "../src/hook-timing.js";

test("known namespace aliases preserve classification without trusting arbitrary suffixes", () => {
  for (const toolName of ["openclawweb_search", "openclaw__web_search", "openclawskills_read", "skills_search", "github_identity_status", "openclawsession_status", "ls"]) {
    assert.equal(classifyToolCall({ toolName, params: {} }).kind, "read", toolName);
  }
  for (const toolName of ["message", "openclawmessage", "openclaw__message"]) {
    assert.equal(classifyToolCall({ toolName, params: { action: "send" } }).consequential, true);
    assert.equal(classifyToolCall({ toolName, params: { action: "read" } }).consequential, false);
    assert.equal(classifyToolCall({ toolName, params: { action: "delete" } }).consequential, true);
    assert.equal(classifyToolCall({ toolName, params: {} }).consequential, true);
  }
  for (const toolName of ["openclawsecrets", "secrets"]) {
    assert.equal(classifyToolCall({ toolName, params: { action: "list" } }).consequential, false);
    assert.equal(classifyToolCall({ toolName, params: { action: "request" } }).consequential, true);
    assert.equal(classifyToolCall({ toolName, params: {} }).consequential, true);
  }
  assert.equal(classifyToolCall({ toolName: "openclawskill_workshop", params: { action: "read" } }).consequential, false);
  assert.equal(classifyToolCall({ toolName: "openclawskill_workshop", params: { action: "apply" } }).kind, "capability_mutation");
  assert.equal(classifyToolCall({ toolName: "subagents", params: { action: "cancel" } }).consequential, true);
  assert.equal(classifyToolCall({ toolName: "clocksleep", params: {} }).consequential, false);
  for (const toolName of ["evil__web_search", "openclaw__future_tool"]) {
    assert.equal(classifyToolCall({ toolName, params: {} }).kind, "unknown");
  }
});

test("hook timing includes awaited work, survives errors, and bounds its in-memory tail", async () => {
  let current = 0;
  const timing = createHookTiming({ now: () => current, maxSamples: 2 });
  assert.equal(await timing.wrap("before", async () => { await Promise.resolve(); current += 7; return undefined; })(), undefined);
  await assert.rejects(timing.wrap("after", async () => { current += 11; throw new Error("private-failure"); })(), /private-failure/);
  await timing.wrap("before", async () => { current += 3; })();
  assert.deepEqual(timing.drain(), { samples: [{ phase: "before", durationMs: 7 }, { phase: "after", durationMs: 11 }], dropped: 1 });
  assert.deepEqual(timing.drain(), { samples: [], dropped: 0 });
});

test("production timing persists only previous completed hook work, never tool duration", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sylar-timing-"));
  const auditPath = join(dir, "audit.jsonl");
  const runtime = createSarRuntime({ config: { auditPath }, logger: { error() {} } });
  await runtime.before({ toolName: "exec", toolCallId: "one", params: {} }, context);
  await runtime.after({ toolName: "exec", toolCallId: "one", durationMs: 999999, result: "private-result" }, context);
  await runtime.before({ toolName: "exec", toolCallId: "two", params: {} }, context);
  const records = (await readFile(auditPath, "utf8")).trim().split("\n").map(JSON.parse);
  assert.equal(records[0].observer.samples.length, 0);
  assert.deepEqual(records[2].observer.samples.map((sample) => sample.phase), ["before", "after"]);
  const report = buildShadowReport(records);
  assert.equal(report.execution.durationMs.max, 999999);
  assert.equal(report.observer.hookOverheadMs.before.count, 1);
  assert.equal(report.observer.hookOverheadMs.after.count, 1);
  assert.ok(report.observer.hookOverheadMs.after.max < 999999);
  assert.equal(report.gates.hookOverheadMeasured, true);
  assert.equal(report.gates.hookOverheadBudget, false);
  assert.deepEqual(report.privacy.schemaDrift, []);
  assert.equal(report.verdict, "NOT_READY_FOR_ENFORCEMENT");
});

const context = {
  agentId: "agent:test",
  sessionId: "session-super-private",
  runId: "run-super-private",
  requester: { channel: "discord", senderId: "sender-private-id", senderIsOwner: true, roleIds: ["role-private-id"] },
};

test("normalizer stores shape but no raw parameter, requester, path, or correlation values", () => {
  const event = {
    toolName: "message", toolCallId: "call-super-private", runId: "run-super-private",
    params: {
      action: "send",
      target: "recipient-unique-7419",
      body: "payload-unique-8531",
      token: "credential-unique-9637",
      "attacker-controlled-key-4286": "ordinary-value-7412",
      result: { "nested-private-key-3951": "nested-private-value-6028" },
    },
    derivedPaths: ["/private/path/unique-1234"],
  };
  const record = normalizeBeforeToolCall(event, context, { processSalt: "test-salt" });
  assert.equal(record.mode, "shadow");
  assert.equal(record.schemaVersion, 2);
  assert.equal(record.enforced, false);
  assert.equal(record.policy.semanticReviewCandidate, true);
  assert.equal(record.tool.derivedPathCount, 1);
  assert.equal(containsRawValue(record, event.params), false);
  const serialized = JSON.stringify(record);
  for (const secret of [
    event.toolCallId,
    event.runId,
    context.sessionId,
    context.requester.senderId,
    context.requester.roleIds[0],
    event.derivedPaths[0],
    "attacker-controlled-key-4286",
    "nested-private-key-3951",
  ]) {
    assert.equal(serialized.includes(secret), false, secret);
  }
});

test("classification defaults unknown tools into review", () => {
  assert.deepEqual(classifyToolCall({ toolName: "future_tool", params: {} }), {
    kind: "unknown", consequential: true, reason: "unknown-tools-fail-into-review",
  });
  assert.equal(classifyToolCall({ toolName: "web_search", params: {} }).consequential, false);
  assert.equal(classifyToolCall({ toolName: "message", params: { action: "react" } }).consequential, false);
  assert.equal(classifyToolCall({ toolName: "progress_card", params: {} }).consequential, false);
  assert.equal(classifyToolCall({ toolName: "openclawgateway_exec", params: {} }).kind, "code_execution");
  assert.equal(classifyToolCall({ toolName: "process", params: {} }).kind, "code_execution");
  assert.equal(classifyToolCall({ toolName: "openclawmemory_search", params: {} }).kind, "read");
  assert.equal(classifyToolCall({ toolName: "heartbeat_respond", params: { notify: false } }).consequential, false);
  assert.equal(classifyToolCall({ toolName: "heartbeat_respond", params: { notify: true } }).kind, "notification_send");
  assert.equal(classifyToolCall({ toolName: "skill_workshop", params: {} }).kind, "capability_mutation");
});

test("shadow report fails closed on unknown coverage, pairing, and schema drift", () => {
  const timestamp = "2026-01-01T00:00:00.000Z";
  const proposal = {
    schemaVersion: 2, recordType: "proposed_effect", timestamp, eventId: "one", mode: "shadow", enforced: false,
    tool: { name: "future_tool", kind: null, inputKind: null, classification: { kind: "unknown", consequential: true, reason: "unknown-tools-fail-into-review" }, parameterShape: { keyCount: 0, fields: [], truncated: false }, derivedPathCount: 0 },
    actor: { agentId: "main", requesterProven: true, requesterOwner: true, channel: "test", roleCount: 0 },
    correlation: { run: "opaque", toolCall: "opaque", session: "opaque" },
    policy: { rulesVersion: "shadow-2", semanticReviewCandidate: true, shadowRecommendation: "review", reason: "unknown-tools-fail-into-review" },
  };
  const report = buildShadowReport([{ ...proposal, unexpected: "forbidden" }], { now: Date.parse("2026-01-02T00:00:00.000Z") });
  assert.equal(report.pairing.rate, 0);
  assert.equal(report.execution.outcomeUnknown, 1);
  assert.equal(report.execution.outcomeUnknownRate, 1);
  assert.equal(report.execution.outcomeAccountingRate, 0);
  assert.deepEqual(report.execution.logicalOutcomes, [{ value: "outcome_unknown", count: 1 }]);
  assert.equal(report.gates.outcomeAccounting, false);
  assert.equal(report.blockers.includes("outcome-unknown-above-1-percent"), true);
  assert.equal(report.coverage.unknownRate, 1);
  assert.deepEqual(report.privacy.schemaDrift, ["unexpected"]);
  assert.equal(report.verdict, "NOT_READY_FOR_ENFORCEMENT");
});

test("logical outcome accounting distinguishes completed, error, and missing post-hooks", () => {
  const timestamp = "2026-01-01T00:00:00.000Z";
  const proposal = (eventId, toolCall) => ({
    schemaVersion: 2, recordType: "proposed_effect", timestamp, eventId, mode: "shadow", enforced: false,
    tool: { name: "exec", classification: { kind: "code_execution", consequential: true, reason: "test" } },
    correlation: { run: "run", toolCall, session: "session" },
  });
  const actual = (eventId, status, errorPresent) => ({
    schemaVersion: 2, recordType: "actual_effect", timestamp, eventId, mode: "shadow", enforced: false,
    tool: { name: "exec", observedName: "exec", nameChanged: false },
    result: { status, durationMs: 1, shape: { type: "undefined" }, errorPresent },
  });
  const report = buildShadowReport([
    proposal("completed", "call-1"), actual("completed", "completed", false),
    proposal("error", "call-2"), actual("error", "error", true),
    proposal("missing", "call-3"),
  ], { now: Date.parse("2026-01-02T00:00:00.000Z") });
  assert.deepEqual(report.execution.logicalOutcomes, [
    { value: "completed", count: 1 },
    { value: "error", count: 1 },
    { value: "outcome_unknown", count: 1 },
  ]);
  assert.equal(report.execution.outcomeUnknown, 1);
  assert.equal(report.execution.outcomeAccountingRate, 2 / 3);
});

test("corrected aliases do not fall into unknown review", () => {
  for (const toolName of ["openclawgateway_exec", "openclawgateway_process", "process"]) {
    assert.notEqual(classifyToolCall({ toolName, params: {} }).kind, "unknown");
  }
  for (const toolName of ["progress_card", "openclawmemory_search"]) {
    assert.equal(classifyToolCall({ toolName, params: {} }).consequential, false);
  }
});

test("observed OpenClaw aliases receive explicit action-sensitive classifications", () => {
  for (const toolName of [
    "read", "openclawread", "openclawweb_fetch", "openclawsessions_history",
    "openclawsessions_list", "openclawgithub_identity_status",
  ]) {
    assert.deepEqual(classifyToolCall({ toolName, params: {} }), {
      kind: "read", consequential: false, reason: "known-read-tool",
    });
  }
  assert.equal(classifyToolCall({ toolName: "openclawwrite", params: {} }).kind, "file_write");
  assert.equal(classifyToolCall({ toolName: "sessions_send", params: {} }).kind, "message_send");
  assert.equal(classifyToolCall({ toolName: "sessions_spawn", params: {} }).kind, "agent_spawn");
  assert.equal(classifyToolCall({ toolName: "sessions_yield", params: {} }).consequential, false);
  assert.equal(classifyToolCall({ toolName: "ask_user", params: {} }).kind, "message_send");

  assert.deepEqual(classifyToolCall({ toolName: "automations", params: { action: "history" } }), {
    kind: "automation_metadata", consequential: false, reason: "automation-read-action",
  });
  assert.deepEqual(classifyToolCall({ toolName: "automations", params: { action: "enable" } }), {
    kind: "automation_mutation", consequential: true, reason: "automation-mutation-or-unknown-action",
  });
  assert.equal(classifyToolCall({ toolName: "automations", params: {} }).consequential, true);
});

test("runtime records a paired proposal/result and never returns a policy decision", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sylar-sar-"));
  const auditPath = join(dir, "audit.jsonl");
  const runtime = createSarRuntime({ config: { auditPath }, processSalt: "test-salt", logger: { error() {} } });
  const params = { action: "send", target: "recipient-unique-1592", body: "payload-unique-6574" };
  const beforeResult = await runtime.before({ toolName: "message", toolCallId: "call-1", params }, context);
  const afterResult = await runtime.after({ toolName: "gateway_message", toolCallId: "call-1", params, result: { messageId: "result-secret-9513" }, durationMs: 7 }, context);
  assert.equal(beforeResult, undefined);
  assert.equal(afterResult, undefined);
  const records = (await readFile(auditPath, "utf8")).trim().split("\n").map(JSON.parse);
  assert.equal(records.length, 2);
  assert.equal(records[0].eventId, records[1].eventId);
  assert.equal(records[0].recordType, "proposed_effect");
  assert.equal(records[1].recordType, "actual_effect");
  assert.equal(records[1].schemaVersion, 2);
  assert.deepEqual(records[1].tool, { name: "message", observedName: "gateway_message", nameChanged: true });
  const serialized = JSON.stringify(records);
  for (const secret of [params.target, params.body, "result-secret-9513"]) assert.equal(serialized.includes(secret), false);
  assert.equal((await stat(auditPath)).mode & 0o777, 0o600);
  assert.equal((await stat(dir)).mode & 0o777, 0o700);
});

test("runtime deduplicates wrapper and inner before hooks with the same tool-call id", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sylar-sar-"));
  const auditPath = join(dir, "dedupe.jsonl");
  const runtime = createSarRuntime({ config: { auditPath }, processSalt: "test-salt", logger: { error() {} } });
  await runtime.before({ toolName: "openclawgateway_exec", toolCallId: "same-call", params: { command: "private-one" } }, context);
  await runtime.before({ toolName: "exec", toolCallId: "same-call", params: { command: "private-one" } }, context);
  await runtime.after({ toolName: "exec", toolCallId: "same-call", result: "private-result" }, context);
  const records = (await readFile(auditPath, "utf8")).trim().split("\n").map(JSON.parse);
  assert.equal(records.length, 2);
  assert.equal(records[0].recordType, "proposed_effect");
  assert.equal(records[1].recordType, "actual_effect");
  assert.equal(records[0].eventId, records[1].eventId);
});

test("reads are omitted by default and can be included explicitly", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sylar-sar-"));
  const skippedPath = join(dir, "skipped.jsonl");
  const skipped = createSarRuntime({ config: { auditPath: skippedPath }, processSalt: "salt", logger: { error() {} } });
  await skipped.before({ toolName: "web_search", toolCallId: "read-1", params: { query: "private-query-7531" } }, context);
  await assert.rejects(readFile(skippedPath, "utf8"), /ENOENT/);

  const includedPath = join(dir, "included.jsonl");
  const included = createSarRuntime({ config: { auditPath: includedPath, includeReads: true }, processSalt: "salt", logger: { error() {} } });
  await included.before({ toolName: "web_search", toolCallId: "read-2", params: { query: "private-query-8642" } }, context);
  const contents = await readFile(includedPath, "utf8");
  assert.equal(contents.includes("private-query-8642"), false);
});

test("audit sink rejects relative paths", () => {
  assert.throws(() => new JsonlAuditSink("relative/audit.jsonl"), /absolute/);
});

test("error records disclose presence but not error text", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sylar-sar-"));
  const auditPath = join(dir, "errors.jsonl");
  const runtime = createSarRuntime({ config: { auditPath }, processSalt: "salt", logger: { error() {} } });
  await runtime.before({ toolName: "exec", toolCallId: "exec-1", params: { command: "private-command-2222" } }, context);
  await runtime.after({ toolName: "exec", toolCallId: "exec-1", params: {}, error: "private-error-3333" }, context);
  const contents = await readFile(auditPath, "utf8");
  assert.equal(contents.includes("private-command-2222"), false);
  assert.equal(contents.includes("private-error-3333"), false);
  assert.equal(JSON.parse(contents.trim().split("\n")[1]).result.errorPresent, true);
});

test("ephemeral envelope enforces item, concurrency, and total-byte bounds", () => {
  const timers = [];
  const store = new EphemeralReviewEnvelopeStore({
    maxConcurrent: 2,
    maxEnvelopeBytes: 96,
    maxTotalBytes: 100,
    ttlMs: 1_000,
    schedule(callback) { const timer = { callback, unref() {} }; timers.push(timer); return timer; },
    unschedule() {},
  });
  store.admit({ eventId: "one", action: { body: "a".repeat(40) } });
  assert.throws(() => store.admit({ eventId: "oversized", action: { body: "b".repeat(200) } }), { code: "envelope_size_limit" });
  assert.throws(() => store.admit({ eventId: "two", action: { body: "c".repeat(60) } }), { code: "total_size_limit" });
  store.admit({ eventId: "two", action: { ok: true } });
  assert.throws(() => store.admit({ eventId: "three", action: {} }), { code: "concurrent_limit" });
  assert.equal(store.stats().count, 2);
});

test("ephemeral envelope expires, cancels, and shuts down without persistence", () => {
  let current = 1_000;
  const scheduled = [];
  const store = new EphemeralReviewEnvelopeStore({
    ttlMs: 50,
    now: () => current,
    schedule(callback) { const timer = { callback, unref() {} }; scheduled.push(timer); return timer; },
    unschedule() {},
  });
  store.admit({ eventId: "expires", action: { secret: "expiry-secret-4812" } });
  current = 1_051;
  scheduled[0].callback();
  assert.deepEqual(store.stats(), { count: 0, totalBytes: 0, reviewerBusy: false });
  assert.throws(() => store.beginReview("expires"), { code: "envelope_unavailable" });

  store.admit({ eventId: "cancel", action: { secret: "cancel-secret-9234" } });
  assert.equal(store.cancel("cancel"), true);
  store.admit({ eventId: "shutdown", action: { secret: "shutdown-secret-5371" } });
  store.shutdown();
  assert.deepEqual(store.stats(), { count: 0, totalBytes: 0, reviewerBusy: false });
  assert.throws(() => store.admit({ eventId: "late", action: {} }), { code: "store_closed" });
});

test("semantic review returns fixed redacted metadata and deletes raw action", () => {
  const store = new EphemeralReviewEnvelopeStore();
  const raw = {
    target: "recipient-private-1551",
    body: "message-private-2662",
    command: "command-private-3773",
    url: "https://private.example/4884",
    path: "/private/path/5995",
    "attacker-private-key-6006": "identifier-private-7117",
  };
  store.admit({ eventId: "opaque-event", action: raw });
  const review = store.beginReview("opaque-event");
  assert.deepEqual(review.action, raw);
  assert.throws(() => store.beginReview("opaque-event"), { code: "reviewer_busy" });
  const metadata = store.finishReview("opaque-event", {
    decision: "approval_required",
    reviewerStatus: "ok",
    latencyMs: 247,
    rationale: "Contains a consequential external effect.",
  });
  assert.deepEqual(metadata, {
    schemaVersion: 1,
    recordType: "semantic_review",
    eventId: "opaque-event",
    label: "approval_required",
    reviewerStatus: "ok",
    latencyBucket: "100_499ms",
  });
  const serialized = JSON.stringify(metadata);
  for (const [key, value] of Object.entries(raw)) {
    assert.equal(serialized.includes(key), false);
    assert.equal(serialized.includes(value), false);
  }
  assert.deepEqual(store.stats(), { count: 0, totalBytes: 0, reviewerBusy: false });
});

test("abrupt reviewer-process failure leaves no envelope artifact or raw value in output", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sylar-envelope-crash-"));
  const modulePath = new URL("../src/ephemeral-review-envelope.js", import.meta.url).href;
  const secret = "crash-private-value-8228";
  const script = `import { EphemeralReviewEnvelopeStore } from ${JSON.stringify(modulePath)};\n` +
    `const store = new EphemeralReviewEnvelopeStore();\n` +
    `store.admit({ eventId: "opaque", action: { body: ${JSON.stringify(secret)} } });\n` +
    `throw new Error("simulated reviewer crash");\n`;
  const child = spawnSync(process.execPath, ["--input-type=module", "--eval", script], { cwd: dir, encoding: "utf8" });
  assert.notEqual(child.status, 0);
  assert.equal(child.stdout.includes(secret), false);
  assert.equal(child.stderr.includes(secret), false);
  assert.deepEqual(await readdir(dir), []);
});
