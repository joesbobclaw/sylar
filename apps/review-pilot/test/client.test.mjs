import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const script = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const tick = () => new Promise((resolve) => setImmediate(resolve));
function harness(pathname = "/") {
 const elements = new Map(); const listeners = {}; const timers = []; let now = 0; let current;
 const element = (id) => {
  if (!elements.has(id)) elements.set(id, { textContent: "", value: "", hidden: false, checked: false, disabled: false,
   querySelector: () => element(`${id}-child`), set innerHTML(_value) { throw new Error("HTML injection sink used"); } });
  return elements.get(id);
 };
 const buttons = ["allow", "approval_required", "human_only", "deny"].map((decision) => ({ dataset: { decision }, disabled: false }));
 const document = { hidden: false, getElementById: element, querySelectorAll: () => buttons,
  addEventListener: (name, fn) => { listeners[name] = fn; } };
 const calls = [];
 const context = { document, window: { addEventListener: (name, fn) => { listeners[name] = fn; } },
  location: { hash: "#access=bootstrap", pathname }, history: { replaceState: () => { context.location.hash = ""; } },
  performance: { now: () => now }, URLSearchParams, setInterval: (fn) => timers.push(fn),
  fetch: async (path, options) => {
   calls.push({ path, options });
   path = path.replace(/^\/sylar\//, "/");
   let data;
   if (path === "/api/session") data = { csrf: "csrf", allowProspective: false };
   if (path === "/api/current") data = { item: current };
   if (path === "/api/label") { current = null; data = { humanDecision: "allow", reviewerDecision: "deny", reviewerStatus: "ok", agrees: false, recorded: true }; }
   if (path === "/api/cancel") { current = null; data = { cancelled: true }; }
   return { ok: true, json: async () => data };
  } };
 vm.runInNewContext(script, context);
 return { element, document, buttons, calls, listeners, timers,
  setHash: (value) => { context.location.hash = value; },
  setCurrent: (value) => { current = value; }, setNow: (value) => { now = value; } };
}
const item = () => ({ sampleId: "sample-0001", source: "synthetic", category: "message", ready: true,
 remainingMs: 1000, effect: { body: "<img onerror=alert(1)>raw-client-marker" } });
test("actual client uses text-only rendering, seals comparison, commits then wipes and clears access fragment", async () => {
 const h = harness(); await tick();
 assert.equal(h.element("workspace").hidden, false);
 h.setCurrent(item()); await h.element("refresh").onclick();
 assert.ok(h.element("effect").textContent.includes("<img onerror"));
 assert.equal(h.element("result").textContent, "");
 h.element("independent").checked = true;
 await h.buttons[0].onclick();
 assert.equal(h.element("effect").textContent, ""); assert.equal(h.element("prepared").value, "");
 assert.equal(h.element("review").hidden, true); assert.equal(h.element("comparison").hidden, false);
 assert.ok(h.element("result").textContent.includes("Reviewer: deny"));
 assert.equal(h.calls[0].options.body.includes("bootstrap"), true);
});
test("client uses monotonic remaining time and wipes on expiry, visibility loss and pagehide", async () => {
 for (const event of ["expiry", "visibilitychange", "pagehide"]) {
  const h = harness(); await tick(); h.setCurrent(item()); await h.element("refresh").onclick();
  if (event === "expiry") { h.setNow(1001); h.timers[0](); }
  else { if (event === "visibilitychange") h.document.hidden = true; h.listeners[event](); }
  assert.equal(h.element("effect").textContent, ""); assert.equal(h.element("review").hidden, true);
  assert.ok(h.calls.some((call) => call.path === "/api/cancel"));
 }
});
test("hidden client cannot reinsert a raw action on refresh", async () => {
 const h = harness(); await tick(); h.setCurrent(item()); h.document.hidden = true;
 await h.element("refresh").onclick(); assert.equal(h.element("effect").textContent, "");
});

test("client stays on its dedicated remote prefix for login, API and discard", async () => {
 const h=harness('/sylar/'); await tick();h.setCurrent(item());await h.element('refresh').onclick();h.listeners.pagehide();
 assert.ok(h.calls.length>=3);assert.ok(h.calls.every(call=>call.path.startsWith('/sylar/api/')));
});

test("opening a fresh private fragment in an already-open tab reauthenticates and clears it", async () => {
 const h=harness('/sylar/');await tick();h.setHash('#access=fresh-login');await h.listeners.hashchange();
 const logins=h.calls.filter(call=>call.path==='/sylar/api/session'&&call.options.body);
 assert.equal(logins.length,2);assert.ok(logins[1].options.body.includes('fresh-login'));
 assert.equal(h.element('workspace').hidden,false);
});
