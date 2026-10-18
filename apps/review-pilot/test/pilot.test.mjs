import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { mkdtemp, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PilotService } from "../service.mjs";
import { createPilotServer } from "../server.mjs";
import { createReviewer } from "../reviewer.mjs";
const effect = (extra = {}) => ({ schemaVersion: 1, id: "study-copy", actor: { id: "test", type: "agent" },
 request: { source: "synthetic", instruction: "Send to intended@example.invalid only" },
 operation: { kind: "message_send", tool: "message", action: "send", target: "private-target-marker-849", content: "<img src=x onerror=alert(1)> private-body-marker-472" },
 authorization: { structuralAllowed: true }, recipients: [{ address: "private-target-marker-849", scope: "external" }],
 dataClasses: ["public"], reversibility: "irreversible", expectedResult: "A copied effect, never executed",
 ruleSet: { version: "test", rules: [] }, idempotencyKey: "study-only", ...extra });
const admission = (extra = {}) => ({ source: "synthetic", category: "message", effect: effect(), ...extra });

test("blind review hides result; human commit deletes raw before fixed metadata persistence", async () => {
 let service, persisted;
 service = new PilotService({ reviewer: async () => ({ outcome: "deny", reason: "private-provider-rationale" }), persist: async (row) => {
  assert.equal(service.active, null); assert.equal(service.store.stats().count, 0); persisted = row;
 } });
 await service.admit(admission());
 const visible = service.current();
 assert.ok(visible.effect);
 for (const key of ["decision", "sealed", "reviewerDecision", "reviewerStatus", "rationale"]) assert.equal(Object.hasOwn(visible, key), false);
 const result = await service.label({ sampleId: visible.sampleId, decision: "allow", humanIndependent: true });
 assert.equal(result.reviewerDecision, "deny"); assert.equal(result.agrees, false); assert.equal(service.current(), null);
 const report = service.report();
 for (const marker of ["private-target-marker-849", "private-body-marker-472", "private-provider-rationale"]) assert.equal(JSON.stringify([persisted, report, result]).includes(marker), false);
 assert.equal(report.eligible, 0);
 await assert.rejects(service.label({ sampleId: visible.sampleId, decision: "allow", humanIndependent: true }));
 service.shutdown();
});
test("capacity, size, prospective gate, timeout and structural floor fail closed", async () => {
 const service = new PilotService({ reviewer: async () => ({ outcome: "allow" }) });
 await assert.rejects(service.admit(admission({ source: "prospective" })));
 await assert.rejects(service.admit(admission({ effect: {} })));
 await assert.rejects(service.admit(admission({ category: "publication" })));
 await assert.rejects(service.admit(admission({ effect: effect({ expectedResult: "x".repeat(300000) }) })));
 await service.admit(admission({ effect: effect({ authorization: { structuralAllowed: false } }) }));
 await assert.rejects(service.admit(admission()));
 const result = await service.label({ sampleId: service.current().sampleId, decision: "deny", humanIndependent: false });
 assert.equal(result.reviewerDecision, "deny"); service.shutdown();
 const failed = new PilotService({ reviewer: async () => { throw new Error("timeout"); } });
 await failed.admit(admission());
 const row = await failed.label({ sampleId: failed.current().sampleId, decision: "allow", humanIndependent: false });
 assert.equal(row.reviewerDecision, "human_only"); assert.equal(row.reviewerStatus, "timeout");
 assert.equal(failed.report().attrition.reviewerFailures, 1); failed.shutdown();
});
test("expiry, cancel and shutdown abort reviewer and remove all store values", async () => {
 for (const mode of ["expired", "cancelled", "shutdown"]) {
  let signal, current = 100;
  const service = new PilotService({ now: () => current, ttlMs: 1000, reviewer: async (_effect, options) => {
   signal = options.signal;
   await new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true })); throw new Error("cancelled");
  } });
  const pending = service.admit(admission());
  if (mode === "expired") { current = 1101; assert.equal(service.current(), null); }
  else if (mode === "shutdown") service.shutdown(); else service.remove();
  await pending;
  assert.equal(signal.aborted, true); assert.equal(service.store.stats().count, 0);
  assert.equal(service.store.stats().totalBytes, 0); assert.equal(service.active, null); service.shutdown();
 }
});
test("expiry timer discards without human or polling request", async () => {
 const service = new PilotService({ ttlMs: 25, reviewer: async () => ({ outcome: "allow" }) });
 await service.admit(admission()); await new Promise((resolve) => setTimeout(resolve, 45));
 assert.equal(service.active, null); assert.equal(service.store.stats().count, 0); assert.equal(service.counts.expired, 1); service.shutdown();
});
test("HTTP prevents pre-label disclosure, unauth reads, cross-origin/CSRF writes and raw error echo", async (t) => {
 const app = createPilotServer({ reviewer: async () => ({ outcome: "deny" }), publicUrl: "http://127.0.0.1" });
 await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
 t.after(() => { app.service.shutdown(); app.server.closeAllConnections(); app.server.close(); });
 const base = `http://127.0.0.1:${app.server.address().port}`;
 const post = (path, body, extra = {}) => fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://127.0.0.1", ...extra }, body: JSON.stringify(body) });
 assert.equal((await fetch(base + "/api/current")).status, 401);
 assert.equal((await post("/api/session", { key: "bad-private-key" })).status, 401);
 const login = await post("/api/session", { key: app.bootKey }); assert.equal(login.status, 200);
 assert.ok(login.headers.get("set-cookie").includes("HttpOnly")); assert.equal(login.headers.get("cache-control"), "no-store, max-age=0");
 const cookie = login.headers.get("set-cookie").split(";")[0]; const { csrf } = await login.json();
 const headers = { Cookie: cookie, "X-Pilot-CSRF": csrf };
 assert.equal((await post("/api/admit", admission(), { Cookie: cookie })).status, 403);
 assert.equal((await post("/api/admit", admission(), { ...headers, Origin: "https://attacker.invalid" })).status, 403);
 assert.equal((await post("/api/admit", admission(), headers)).status, 200);
 const current = await (await fetch(base + "/api/current", { headers: { Cookie: cookie } })).json();
 assert.ok(current.item.effect); assert.equal(JSON.stringify(current).includes('"deny"'), false);
 assert.equal((await post("/api/label", { sampleId: current.item.sampleId, decision: "allow", humanIndependent: true, rationale: "private-bad-key" }, headers)).status, 400);
 const label = await post("/api/label", { sampleId: current.item.sampleId, decision: "allow", humanIndependent: true }, headers);
 assert.equal(label.status, 200); assert.equal((await label.json()).reviewerDecision, "deny");
 assert.equal((await (await fetch(base + "/api/current", { headers: { Cookie: cookie } })).json()).item, null);
 const oversized = await post("/api/admit", { effect: "private-size-marker".repeat(20000) }, headers);
 assert.equal(oversized.status, 413); assert.equal((await oversized.text()).includes("private-size-marker"), false);
});
test("reviewer uses bounded stdin, not OS argv; abort kills child and never relays errors", async () => {
 let args, options, input = "", killed;
 const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
 child.stdin.on("data", (chunk) => { input += chunk; }); child.kill = (signal) => { killed = signal; };
 const reviewer = createReviewer({ cliModule: "/installed/cli/run-main.js", launch: (_bin, argv, opts) => { args = argv; options = opts; return child; } });
 const controller = new AbortController(); const pending = reviewer(effect(), { signal: controller.signal });
 assert.equal(JSON.stringify(args).includes("private-body-marker-472"), false); assert.equal(JSON.stringify(options).includes("private-body-marker-472"), false);
 assert.equal(input.includes("private-body-marker-472"), true); child.stderr.write("raw-secret-provider-error"); controller.abort();
 await assert.rejects(pending, (error) => error.message === "cancelled"); assert.equal(killed, "SIGKILL");
});
test("abrupt process failure leaves no raw artifact or raw output", async () => {
 const dir = await mkdtemp(join(tmpdir(), "sylar-pilot-crash-"));
 const script = `import {PilotService} from ${JSON.stringify(new URL("../service.mjs", import.meta.url).href)}; const p=new PilotService({reviewer:async()=>({outcome:'deny'})}); await p.admit(${JSON.stringify(admission())}); process.kill(process.pid,'SIGKILL');`;
 const result = spawnSync(process.execPath, ["--input-type=module", "--eval", script], { cwd: dir, encoding: "utf8" });
 assert.notEqual(result.status, 0); assert.equal((result.stdout + result.stderr).includes("private-body-marker-472"), false); assert.deepEqual(await readdir(dir), []);
});

test("prospective study accepts no more than twelve admissions and preserves attrition", async () => {
 const service = new PilotService({ allowProspective: true, reviewer: async () => ({ outcome: "allow" }) });
 for (let index = 0; index < 12; index++) {
  await service.admit(admission({ source: "prospective" })); service.remove();
 }
 await assert.rejects(service.admit(admission({ source: "prospective" })));
 assert.equal(service.report().prospectiveAdmissions, 12);
 assert.equal(service.report().attrition.cancelled, 12);
 service.shutdown();
});

test("HTTP intake bounds concurrent raw request bodies before buffering", async (t) => {
 const { request } = await import("node:http");
 const app = createPilotServer({ reviewer: async () => ({ outcome: "deny" }), publicUrl: "http://127.0.0.1" });
 await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
 const base = `http://127.0.0.1:${app.server.address().port}`;
 const requests = [];
 t.after(() => { requests.forEach((req) => req.destroy()); app.service.shutdown(); app.server.closeAllConnections(); app.server.close(); });
 for (let index = 0; index < 4; index++) {
  const started = new Promise((resolve) => app.server.once("request", resolve));
  const req = request(base + "/api/session", { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://127.0.0.1" } });
  req.on("error", () => {}); requests.push(req); req.write('{"key":'); await started;
 }
 const fifth = await fetch(base + "/api/session", { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://127.0.0.1" }, body: JSON.stringify({ key: app.bootKey }) });
 assert.equal(fifth.status, 429);
});
