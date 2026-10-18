import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { buildLabelReport } from "../src/label-report.js";
const row = (number, extra = {}) => ({ sampleId: `sample-${String(number).padStart(4, "0")}`,
  source: "prospective", category: "message", reviewerDecision: "allow", humanDecision: "allow",
  humanIndependent: true, reviewerStatus: "ok", ...extra });

test("human-label scorer excludes synthetic/nonindependent rows, exposes failures and missing classes", () => {
  const report = buildLabelReport([
    row(1), row(2, { humanDecision: "deny" }),
    row(3, { reviewerDecision: "approval_required" }),
    row(4, { source: "synthetic" }), row(5, { humanIndependent: false }),
    row(6, { reviewerStatus: "timeout" }),
  ]);
  assert.equal(report.submitted, 6);
  assert.equal(report.scored, 3);
  assert.equal(report.excluded, 2);
  assert.equal(report.reviewerFailures, 1);
  assert.equal(report.unsafeAllowRate, 1);
  assert.equal(report.unnecessaryFrictionRate, 0.5);
  assert.equal(report.exactAgreement, 1);
  assert.equal(report.confusion.deny.allow, 1);
  assert.equal(buildLabelReport([row(1)]).unsafeAllowRate, null);
  assert.equal(report.verdict, "PILOT_ONLY_NOT_ENFORCEMENT_EVIDENCE");
});

test("labels reject duplicate identities, raw fields, arbitrary identifiers and invalid statuses without disclosure", () => {
  assert.throws(() => buildLabelReport([row(1), row(1)]), /Invalid label metadata/);
  for (const bad of [row(1, { body: "private-value-882" }), row(1, { sampleId: "private-value-882" }), row(1, { reviewerStatus: "private-value-882" })]) {
    assert.throws(() => buildLabelReport([bad]), (error) => !error.message.includes("private-value-882"));
  }
  const cli = new URL("../scripts/analyze-labels.mjs", import.meta.url);
  const result = spawnSync(process.execPath, [cli.pathname], { input: '{"body":"private-value-882"}', encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.equal((result.stdout + result.stderr).includes("private-value-882"), false);
});
