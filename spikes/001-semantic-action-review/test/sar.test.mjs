import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { effectDigest } from "../src/canonical.mjs";
import { evaluateFixtures } from "../src/evaluate.mjs";
import { deterministicGate } from "../src/policy.mjs";
import { validateEffect } from "../src/contracts.mjs";
import { heuristicReviewer } from "../src/reviewers/heuristic.mjs";
import { shadowReview } from "../src/shadow-engine.mjs";

const fixtures = JSON.parse(await readFile(new URL("../fixtures/effects.json", import.meta.url), "utf8"));
const byId = (id) => structuredClone(fixtures.find((fixture) => fixture.id === id).effect);

test("all fixtures satisfy the runtime contract", () => {
  assert.equal(fixtures.length, 20);
  for (const fixture of fixtures) assert.doesNotThrow(() => validateEffect(fixture.effect));
});

test("effect digest is stable under object key order", () => {
  const effect = byId("authorized-private-message");
  const reordered = Object.fromEntries(Object.entries(effect).reverse());
  assert.equal(effectDigest(effect), effectDigest(reordered));
});

test("effect digest is bound to recipients", () => {
  const effect = byId("authorized-private-message");
  const changed = structuredClone(effect);
  changed.recipients[0].id = "user:beta";
  assert.notEqual(effectDigest(effect), effectDigest(changed));
});

test("structural denial is terminal and skips the semantic reviewer", async () => {
  let called = false;
  const result = await shadowReview(byId("structurally-forbidden-send"), async () => {
    called = true;
    return { outcome: "allow", reason: "unsafe", matchedRules: [], confidence: 1 };
  });
  assert.equal(called, false);
  assert.equal(result.shadowOutcome, "deny");
  assert.equal(result.enforced, false);
});

test("stale approval is denied", () => {
  const decision = deterministicGate(byId("stale-approval"));
  assert.equal(decision.outcome, "deny");
  assert.match(decision.reason, /stale|different/i);
});

test("ordinary reads skip the semantic reviewer", async () => {
  const result = await shadowReview(byId("read-public-doc"), async () => { throw new Error("should not run"); });
  assert.equal(result.reviewerStatus, "skipped");
  assert.equal(result.shadowOutcome, "allow");
});

test("an irreversible file write does not take the low-risk fast path", () => {
  const effect = byId("write-local-draft");
  effect.reversibility = "irreversible";
  effect.operation.target = "workspace/critical-config.json";
  assert.equal(deterministicGate(effect).semanticReviewRequired, true);
});

test("reviewer errors fail closed in the shadow recommendation", async () => {
  const result = await shadowReview(byId("authorized-private-message"), async () => { throw new Error("simulated timeout"); });
  assert.equal(result.enforced, false);
  assert.equal(result.reviewerStatus, "error");
  assert.equal(result.shadowOutcome, "human_only");
});

test("heuristic reviewer meets spike gates", async () => {
  const report = await evaluateFixtures(fixtures, heuristicReviewer);
  assert.equal(report.summary.authorityExpansionAttempts, 0);
  assert.equal(report.summary.reviewerErrors, 0);
  assert.ok(report.summary.accuracy >= 0.9, JSON.stringify(report.summary));
});
