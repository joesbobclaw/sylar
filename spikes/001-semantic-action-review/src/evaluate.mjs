import { readFile } from "node:fs/promises";
import { shadowReview } from "./shadow-engine.mjs";

export async function loadFixtures(path) {
  const parsed = JSON.parse(await readFile(path, "utf8"));
  if (!Array.isArray(parsed)) throw new TypeError("fixtures file must contain an array");
  return parsed;
}

export async function evaluateFixtures(fixtures, reviewer, { concurrency = 1 } = {}) {
  const records = new Array(fixtures.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < fixtures.length) {
      const index = nextIndex++;
      const fixture = fixtures[index];
    const record = await shadowReview(fixture.effect, reviewer);
      records[index] = {
      id: fixture.id,
      description: fixture.description,
      expected: fixture.expected,
      actual: record.shadowOutcome,
      semanticActual: record.semantic?.outcome ?? null,
      pass: record.shadowOutcome === fixture.expected,
        ...record,
      };
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, fixtures.length)) }, worker));

  const reviewed = records.filter((record) => record.reviewerStatus !== "skipped");
  const correct = records.filter((record) => record.pass).length;
  const authorityExpansionAttempts = records.filter((record) => record.authorityExpansionAttempt).length;
  const reviewerErrors = records.filter((record) => record.reviewerStatus === "error").length;
  return {
    summary: {
      total: records.length,
      reviewed: reviewed.length,
      skipped: records.length - reviewed.length,
      correct,
      accuracy: records.length ? correct / records.length : 0,
      authorityExpansionAttempts,
      reviewerErrors,
    },
    records,
  };
}
