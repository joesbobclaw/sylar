import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, patchCronBundle } from "./cron-outcome-hook.mjs";
import { createSarRuntime } from "../plugins/semantic-action-review/src/runtime.js";

const makeExecutor = new Function("withGatewayToolCallerIdentity", "caller", "assertActive",
  "wrapToolWithAbortSignal", "rewrapToolWithBeforeToolCallHook", "bindAgentToolSourceExecutionGuard",
  "evaluationScope", "runAgentHarnessAfterToolCallHook", "runId", "runtime", `return ({${after}}).executeTool;`);

for (const outcome of ["success", "throw", "throw-undefined", "cancel", "error-result", "projection-error", "observer-error"]) {
  test(`cron hook bridge preserves ${outcome} and records the actual execution`, async () => {
    const dir = await mkdtemp(join(tmpdir(), "sylar-cron-"));
    const auditPath = join(dir, "audit.jsonl");
    const sar = createSarRuntime({ config: { auditPath } });
    const ctx = { runId: "test-run-private", agentId: "test", sessionKey: "test-session-private" };
    const controller = new AbortController();
    const failure = new Error("private-error");
    const result = { isError: outcome === "error-result", content: "private-result" };
    const observed = [];
    let projections = 0;
    const wrapped = (tool) => ({ async execute(id, input) {
      await sar.before({ toolName: tool.name, toolCallId: id, params: input }, ctx);
      if (outcome === "throw-undefined") throw undefined;
      if (outcome === "throw") throw failure;
      if (outcome === "cancel") { controller.abort(failure); throw failure; }
      return result;
    } });
    const executor = makeExecutor((_caller, fn) => fn(), {}, () => {}, (tool) => tool,
      wrapped, (tool) => tool, { signal: controller.signal }, async (event) => {
        observed.push(event);
        await sar.after({ ...event, params: event.startArgs, durationMs: Date.now() - event.startedAt }, ctx);
        if (outcome === "observer-error") throw new Error("observer failed");
      }, ctx.runId, { context: ctx });
    const call = { tool: { name: "exec" }, toolCallId: "private-call", input: { command: "private-command" },
      async acceptResultBeforeProjection(value) {
        projections++;
        if (outcome === "projection-error") throw failure;
        return value;
      } };
    if (["throw", "throw-undefined", "cancel", "projection-error"].includes(outcome)) {
      let caught = false;
      try { await executor(call); } catch (error) {
        caught = true;
        assert.equal(error, outcome === "throw-undefined" ? undefined : failure);
      }
      assert.equal(caught, true);
    } else assert.equal(await executor(call), result);
    assert.equal(observed.length, 1);
    assert.equal(projections, ["throw", "throw-undefined", "cancel"].includes(outcome) ? 0 : 1);
    const contents = await readFile(auditPath, "utf8");
    const records = contents.trim().split("\n").map(JSON.parse);
    assert.equal(records.length, 2);
    assert.equal(records[0].eventId, records[1].eventId);
    assert.equal(records[1].result.status, ["throw", "throw-undefined", "cancel", "error-result"].includes(outcome) ? "error" : "completed");
    for (const raw of ["private-command", "private-result", "private-error", "private-call", ctx.sessionKey, ctx.runId])
      assert.equal(contents.includes(raw), false);
  });
}

test("version-pinned patch rejects unknown bundles", () => {
  assert.throws(() => patchCronBundle("unrecognized bundle"), /Unsupported/);
});

test("admission failure never invokes a tool, projection, or post hook", async () => {
  const refusal = new Error("admission expired");
  const unexpected = () => { throw new Error("must not run"); };
  const executor = makeExecutor((_caller, fn) => fn(), {}, () => { throw refusal; },
    unexpected, unexpected, unexpected, { signal: undefined }, unexpected, "run", { context: {} });
  await assert.rejects(executor({ tool: { name: "exec" }, acceptResultBeforeProjection: unexpected }),
    (error) => error === refusal);
});
