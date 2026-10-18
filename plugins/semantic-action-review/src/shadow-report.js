import { TIMING_BOUNDS_MS, timingBin, emptyTimingHistogram } from "./hook-timing.js";

const ALLOWED_SCHEMA_V2_PATHS = new Set([
  "schemaVersion", "recordType", "timestamp", "eventId", "mode", "enforced",
  "observer", "observer.samples", "observer.samples[]", "observer.samples[].phase",
  "observer.samples[].durationMs", "observer.dropped",
  "observer.timingVersion", "observer.invalid", "observer.histograms", "observer.histograms[]",
  "observer.histograms[].phase", "observer.histograms[].counts", "observer.histograms[].counts[]", "observer.histograms[].maxMs",
  "tool", "tool.name", "tool.kind", "tool.inputKind", "tool.classification",
  "tool.classification.kind", "tool.classification.consequential", "tool.classification.reason",
  "tool.parameterShape", "tool.parameterShape.keyCount", "tool.parameterShape.fields",
  "tool.parameterShape.fields[]", "tool.parameterShape.fields[].position",
  "tool.parameterShape.fields[].sensitiveName", "tool.parameterShape.fields[].type",
  "tool.parameterShape.fields[].length", "tool.parameterShape.fields[].size",
  "tool.parameterShape.fields[].finite", "tool.parameterShape.fields[].itemTypes",
  "tool.parameterShape.fields[].itemTypes[]", "tool.parameterShape.fields[].keyCount",
  "tool.parameterShape.fields[].truncated",
  "tool.parameterShape.truncated", "tool.derivedPathCount", "tool.observedName", "tool.nameChanged",
  "actor", "actor.agentId", "actor.requesterProven", "actor.requesterOwner", "actor.channel", "actor.roleCount",
  "correlation", "correlation.run", "correlation.toolCall", "correlation.session",
  "policy", "policy.rulesVersion", "policy.semanticReviewCandidate", "policy.shadowRecommendation", "policy.reason",
  "result", "result.status", "result.durationMs", "result.shape", "result.shape.type",
  "result.shape.length", "result.shape.size", "result.shape.keyCount", "result.shape.truncated",
  "result.shape.finite", "result.shape.itemTypes", "result.shape.itemTypes[]", "result.errorPresent",
]);

function paths(value, prefix = "") {
  if (Array.isArray(value)) {
    const here = `${prefix}[]`;
    return [here, ...value.flatMap((item) => paths(item, here))];
  }
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const here = prefix ? `${prefix}.${key}` : key;
    return [here, ...paths(child, here)];
  });
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

function countBy(values) {
  return Object.entries(values.reduce((counts, value) => {
    const key = value ?? "null";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {})).map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export function buildShadowReport(records, { schemaVersion = 2, now = Date.now(), graceMs = 60_000 } = {}) {
  const selected = records.filter((record) => record.schemaVersion === schemaVersion);
  const proposals = selected.filter((record) => record.recordType === "proposed_effect");
  const actuals = selected.filter((record) => record.recordType === "actual_effect");
  const actualIds = new Set(actuals.map((record) => record.eventId));
  const mature = proposals.filter((record) => now - Date.parse(record.timestamp) >= graceMs);
  const paired = mature.filter((record) => actualIds.has(record.eventId));
  const logicalGroups = new Map();
  for (const proposal of mature) {
    const key = `${proposal.correlation?.run ?? "missing"}:${proposal.correlation?.toolCall ?? proposal.eventId}`;
    const group = logicalGroups.get(key) ?? [];
    group.push(proposal);
    logicalGroups.set(key, group);
  }
  const logicalPaired = [...logicalGroups.values()].filter((group) => group.some((proposal) => actualIds.has(proposal.eventId))).length;
  const actualById = new Map(actuals.map((record) => [record.eventId, record]));
  const logicalOutcomes = [...logicalGroups.values()].map((group) => {
    const actual = group.map((proposal) => actualById.get(proposal.eventId)).find(Boolean);
    if (!actual) return "outcome_unknown";
    return actual.result?.status === "error" ? "error" : "completed";
  });
  const outcomeUnknown = logicalOutcomes.filter((status) => status === "outcome_unknown").length;
  const outcomeUnknownRate = logicalGroups.size ? outcomeUnknown / logicalGroups.size : null;
  const unknown = proposals.filter((record) => record.tool?.classification?.kind === "unknown");
  const schemaDrift = [...new Set(selected.flatMap((record) => paths(record)).filter((path) => !ALLOWED_SCHEMA_V2_PATHS.has(path)))].sort();
  const invalidMode = selected.filter((record) => record.mode !== "shadow" || record.enforced !== false).length;
  const durations = actuals.map((record) => record.result?.durationMs).filter(Number.isFinite);
  const pairingRate = mature.length ? paired.length / mature.length : null;
  const logicalPairingRate = logicalGroups.size ? logicalPaired / logicalGroups.size : null;
  const duplicateProposals = mature.length - logicalGroups.size;
  const unknownRate = proposals.length ? unknown.length / proposals.length : null;
  const timingReport = summarizeTiming(proposals);
  const { hookOverhead, timingDropped, invalidTimings, hookOverheadMeasured } = timingReport;

  return {
    generatedAt: new Date(now).toISOString(),
    schemaVersion,
    sample: { records: selected.length, proposals: proposals.length, actuals: actuals.length, matureProposals: mature.length },
    pairing: {
      paired: paired.length, unpaired: mature.length - paired.length, rate: pairingRate,
      logicalProposals: logicalGroups.size, logicalPaired, logicalRate: logicalPairingRate,
      duplicateProposals, duplicateRate: mature.length ? duplicateProposals / mature.length : null,
      graceMs,
    },
    coverage: {
      unknown: unknown.length,
      unknownRate,
      classifications: countBy(proposals.map((record) => record.tool?.classification?.kind)),
      tools: countBy(proposals.map((record) => record.tool?.name)),
      aliasChanges: actuals.filter((record) => record.tool?.nameChanged === true).length,
    },
    execution: {
      errors: actuals.filter((record) => record.result?.errorPresent === true).length,
      logicalOutcomes: countBy(logicalOutcomes),
      outcomeUnknown,
      outcomeUnknownRate,
      outcomeAccountingRate: logicalGroups.size ? (logicalGroups.size - outcomeUnknown) / logicalGroups.size : null,
      durationMs: { p50: percentile(durations, 0.50), p95: percentile(durations, 0.95), max: durations.length ? Math.max(...durations) : null },
      note: "A mature proposal without a post-hook is outcome_unknown, never completed. Execution duration is tool runtime, not SAR hook overhead.",
    },
    privacy: { schemaDrift, invalidMode },
    observer: {
      hookOverheadMs: hookOverhead, dropped: timingDropped, invalid: invalidTimings,
      percentileMethod: timingReport.percentileMethod,
      note: "Completed hook body wall time including awaited audit IO, excluding tool execution and Gateway scheduling. Fixed-size timing histograms (or legacy samples) are emitted on the next proposal; the final process tail is not persisted. Not paired-call percentiles or semantic reviewer latency.",
    },
    gates: {
      enoughTraffic: proposals.length >= 500,
      pairing: logicalPairingRate !== null && logicalPairingRate >= 0.99,
      outcomeAccounting: outcomeUnknownRate !== null && outcomeUnknownRate <= 0.01,
      duplicateHooks: mature.length > 0 && duplicateProposals / mature.length <= 0.01,
      classificationCoverage: unknownRate !== null && unknownRate <= 0.01,
      schemaStable: schemaDrift.length === 0,
      shadowOnly: invalidMode === 0,
      semanticLabels: false,
      hookOverheadMeasured,
      hookOverheadBudget: false,
    },
    verdict: "NOT_READY_FOR_ENFORCEMENT",
    blockers: [
      ...(proposals.length >= 500 ? [] : ["fewer-than-500-proposals"]),
      ...(logicalPairingRate !== null && logicalPairingRate >= 0.99 ? [] : ["logical-pairing-below-99-percent"]),
      ...(outcomeUnknownRate !== null && outcomeUnknownRate <= 0.01 ? [] : ["outcome-unknown-above-1-percent"]),
      ...(mature.length > 0 && duplicateProposals / mature.length <= 0.01 ? [] : ["duplicate-hook-observation-above-1-percent"]),
      ...(unknownRate !== null && unknownRate <= 0.01 ? [] : ["unknown-classification-above-1-percent"]),
      ...(schemaDrift.length === 0 ? [] : ["schema-drift-detected"]),
      ...(invalidMode === 0 ? [] : ["non-shadow-or-enforced-record-detected"]),
      "semantic-human-labels-not-yet-collected",
      ...(hookOverheadMeasured ? [] : ["sar-hook-overhead-not-yet-measured"]),
      ...(timingDropped ? ["hook-timing-samples-dropped"] : []),
      ...(invalidTimings ? ["invalid-hook-timing-samples"] : []),
      "production-overhead-budget-not-yet-evaluated",
    ],
  };
}


function summarizeTiming(proposals) {
  const merged = [emptyTimingHistogram("before"), emptyTimingHistogram("after")];
  const legacy = { before: [], after: [] };
  let invalidTimings = 0;
  let timingDropped = 0;
  let hasHistogram = false;
  for (const { observer } of proposals) {
    if (!observer) continue;
    const dropped = observer.dropped ?? 0;
    if (!Number.isSafeInteger(dropped) || dropped < 0) invalidTimings++;
    else timingDropped += dropped;
    if (observer.timingVersion !== undefined) {
      hasHistogram = true;
      if (observer.timingVersion !== 2 || !Array.isArray(observer.histograms) || observer.histograms.length !== 2 ||
          !Number.isSafeInteger(observer.invalid) || observer.invalid < 0 || observer.samples !== undefined) {
        invalidTimings++;
        continue;
      }
      invalidTimings += observer.invalid;
      for (let phaseIndex = 0; phaseIndex < 2; phaseIndex++) {
        const source = observer.histograms[phaseIndex];
        const target = merged[phaseIndex];
        if (!source || source.phase !== target.phase || !Array.isArray(source.counts) ||
            source.counts.length !== target.counts.length ||
            !source.counts.every((count) => Number.isSafeInteger(count) && count >= 0)) {
          invalidTimings++;
          continue;
        }
        const count = source.counts.reduce((sum, value) => sum + value, 0);
        if (!Number.isSafeInteger(count) || (count === 0 ? source.maxMs !== null :
            !Number.isFinite(source.maxMs) || source.maxMs < 0 ||
            source.counts[timingBin(source.maxMs)] === 0 ||
            source.counts.slice(timingBin(source.maxMs) + 1).some((value) => value > 0))) {
          invalidTimings++;
          continue;
        }
        source.counts.forEach((value, index) => { target.counts[index] += value; });
        if (count) target.maxMs = Math.max(target.maxMs ?? 0, source.maxMs);
      }
    } else {
      if (observer.histograms !== undefined) { invalidTimings++; continue; }
      for (const sample of observer.samples ?? []) {
        if (!["before", "after"].includes(sample.phase) || !Number.isFinite(sample.durationMs) || sample.durationMs < 0) {
          invalidTimings++;
          continue;
        }
        legacy[sample.phase].push(sample.durationMs);
        const target = merged[sample.phase === "before" ? 0 : 1];
        target.counts[timingBin(sample.durationMs)]++;
        target.maxMs = Math.max(target.maxMs ?? 0, sample.durationMs);
      }
    }
  }
  const hookOverhead = Object.fromEntries(merged.map(({ phase, counts, maxMs }) => {
    const count = counts.reduce((sum, value) => sum + value, 0);
    const upperBound = (fraction) => {
      if (!count) return null;
      const rank = Math.min(count - 1, Math.floor(count * fraction));
      let cumulative = 0;
      const index = counts.findIndex((value) => { cumulative += value; return cumulative > rank; });
      return Math.min(TIMING_BOUNDS_MS[index] ?? maxMs, maxMs);
    };
    return [phase, { count,
      p50: hasHistogram ? upperBound(0.5) : percentile(legacy[phase], 0.5),
      p95: hasHistogram ? upperBound(0.95) : percentile(legacy[phase], 0.95), max: maxMs }];
  }));
  return { hookOverhead, timingDropped, invalidTimings,
    percentileMethod: hasHistogram ? "histogram-upper-bound" : "exact-legacy-samples",
    hookOverheadMeasured: hookOverhead.before.count > 0 && hookOverhead.after.count > 0 && invalidTimings === 0 };
}
