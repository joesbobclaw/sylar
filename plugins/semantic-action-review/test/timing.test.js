import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createHookTiming, TIMING_BOUNDS_MS } from "../src/hook-timing.js";
import { buildShadowReport } from "../src/shadow-report.js";
import { createSarRuntime } from "../src/runtime.js";

const proposal = (observer) => ({ schemaVersion: 2, recordType: "proposed_effect",
  timestamp: "2026-01-01T00:00:00Z", mode: "shadow", enforced: false, observer });

test("long read-only burst retains all counts in constant space and drains once", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sylar-read-burst-"));
  const auditPath = join(dir, "audit.jsonl");
  const runtime = createSarRuntime({ config: { auditPath }, processSalt: "test" });
  for (let index = 0; index < 1000; index++) {
    const event = { toolName: "web_search", toolCallId: `read-${index}`, params: { query: "private-read-marker-923" } };
    assert.equal(await runtime.before(event, {}), undefined);
    assert.equal(await runtime.after({ ...event, result: "private-output-742" }, {}), undefined);
  }
  await assert.rejects(readFile(auditPath), /ENOENT/);
  await runtime.before({ toolName: "exec", toolCallId: "flush", params: {} }, {});
  await runtime.after({ toolName: "exec", toolCallId: "flush", result: null }, {});
  await runtime.before({ toolName: "exec", toolCallId: "flush-two", params: {} }, {});
  const input = await readFile(auditPath, "utf8");
  assert.equal(input.includes("private-read-marker-923"), false);
  assert.equal(input.includes("private-output-742"), false);
  const records = input.trim().split("\n").map(JSON.parse);
  assert.ok(JSON.stringify(records[0].observer).length < 1000);
  assert.equal(records[0].observer.histograms.length, 2);
  assert.ok(records[0].observer.histograms.every((h) => h.counts.length === TIMING_BOUNDS_MS.length + 1));
  const report = buildShadowReport(records);
  assert.equal(report.observer.hookOverheadMs.before.count, 1001);
  assert.equal(report.observer.hookOverheadMs.after.count, 1001);
  assert.equal(report.observer.dropped, 0);
  assert.equal(report.observer.invalid, 0);
  assert.equal(report.observer.percentileMethod, "histogram-upper-bound");
  assert.deepEqual(report.privacy.schemaDrift, []);
});

test("histogram percentiles bound observations, include overflow, and do not double-count legacy", async () => {
  let current = 0;
  const timing = createHookTiming({ now: () => current });
  for (let index = 0; index < 200; index++) {
    await timing.wrap("before", async () => { current += index < 190 ? 8.7 : 15000; })();
    await timing.wrap("after", async () => { current += 26; })();
  }
  const observer = timing.drain();
  const report = buildShadowReport([proposal(observer), proposal({ samples: [
    { phase: "before", durationMs: 9 }, { phase: "after", durationMs: 27 },
  ], dropped: 3 })]);
  assert.equal(report.observer.hookOverheadMs.before.count, 201);
  assert.equal(report.observer.hookOverheadMs.before.p50, 10);
  assert.equal(report.observer.hookOverheadMs.before.p95, 10);
  assert.equal(report.observer.hookOverheadMs.before.max, 15000);
  assert.equal(report.observer.hookOverheadMs.after.p95, 27);
  assert.equal(report.observer.dropped, 3);
  assert.ok(report.blockers.includes("hook-timing-samples-dropped"));
  const overflow = buildShadowReport([proposal({ ...observer, histograms: [
    { ...observer.histograms[0], counts: observer.histograms[0].counts.map((_, i) => i === TIMING_BOUNDS_MS.length ? 1 : 0) },
    observer.histograms[1],
  ] })]);
  assert.equal(overflow.observer.hookOverheadMs.before.p95, 15000);
});

test("invalid clocks, malformed histograms, and unsupported versions block timing evidence", async () => {
  let current = 10;
  const timing = createHookTiming({ now: () => current });
  await timing.wrap("before", async () => { current = 1; })();
  const observer = timing.drain();
  assert.equal(observer.invalid, 1);
  assert.equal(buildShadowReport([proposal(observer)]).gates.hookOverheadMeasured, false);
  for (const malformed of [
    { ...observer, timingVersion: 99 },
    { ...observer, histograms: [] },
    { ...observer, invalid: -1 },
    { ...observer, samples: [{ phase: "before", durationMs: 0 }] },
    { ...observer, histograms: [{ ...observer.histograms[0], counts: [-1] }, observer.histograms[1]] },
    { ...observer, histograms: [{ ...observer.histograms[0], maxMs: 5 }, observer.histograms[1]] },
    { ...observer, histograms: [observer.histograms[1], observer.histograms[0]] },
  ]) {
    const report = buildShadowReport([proposal(malformed)]);
    assert.ok(report.observer.invalid > 0);
    assert.equal(report.gates.hookOverheadMeasured, false);
    assert.ok(report.blockers.includes("invalid-hook-timing-samples"));
  }
});
