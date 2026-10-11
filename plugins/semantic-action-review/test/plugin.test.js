import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { JsonlAuditSink } from "../src/audit-sink.js";
import { classifyToolCall, normalizeBeforeToolCall } from "../src/normalizer.js";
import { containsRawValue } from "../src/redaction.js";
import { createSarRuntime } from "../src/runtime.js";

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
