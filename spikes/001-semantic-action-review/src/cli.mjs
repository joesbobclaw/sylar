#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { evaluateFixtures, loadFixtures } from "./evaluate.mjs";
import { heuristicReviewer } from "./reviewers/heuristic.mjs";
import { createOpenClawModelReviewer } from "./reviewers/openclaw-model.mjs";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const reviewerName = args.get("--reviewer") ?? "heuristic";
const model = args.get("--model") ?? "openai/gpt-5.6-luna";
const concurrency = Number(args.get("--concurrency") ?? (reviewerName === "model" ? 3 : 1));
const fixturePath = resolve(args.get("--fixtures") ?? "fixtures/effects.json");
const only = args.get("--only");
const reviewer = reviewerName === "model"
  ? createOpenClawModelReviewer({ model })
  : heuristicReviewer;

const loadedFixtures = await loadFixtures(fixturePath);
const fixtures = only
  ? loadedFixtures.filter((fixture) => fixture.id === only)
  : loadedFixtures;
if (only && fixtures.length !== 1) throw new Error(`unknown fixture id: ${only}`);
const report = await evaluateFixtures(fixtures, reviewer, { concurrency });
await mkdir("reports", { recursive: true });
const reportPath = resolve(`reports/${reviewerName}-latest.json`);
await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");

console.log(JSON.stringify({ reviewer: reviewerName, model: reviewerName === "model" ? model : null, concurrency, ...report.summary, reportPath }, null, 2));

if (report.summary.authorityExpansionAttempts > 0 || report.summary.reviewerErrors > 0) {
  process.exitCode = 2;
} else if (report.summary.accuracy < 0.9) {
  process.exitCode = 1;
}
