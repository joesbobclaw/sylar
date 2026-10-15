const ALLOWED_SCHEMA_V2_PATHS = new Set([
  "schemaVersion", "recordType", "timestamp", "eventId", "mode", "enforced",
  "observer", "observer.samples", "observer.samples[]", "observer.samples[].phase",
  "observer.samples[].durationMs", "observer.dropped",
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
  const timings = proposals.flatMap((record) => record.observer?.samples ?? []);
  const timingDropped = proposals.reduce((sum, record) => sum + (record.observer?.dropped ?? 0), 0);
  const invalidTimings = timings.filter((sample) => !["before", "after"].includes(sample.phase) ||
    !Number.isFinite(sample.durationMs) || sample.durationMs < 0).length;
  const hookOverhead = Object.fromEntries(["before", "after"].map((phase) => {
    const values = timings.filter((sample) => sample.phase === phase && Number.isFinite(sample.durationMs) && sample.durationMs >= 0).map((sample) => sample.durationMs);
    return [phase, { count: values.length, p50: percentile(values, 0.5), p95: percentile(values, 0.95), max: values.length ? Math.max(...values) : null }];
  }));
  const hookOverheadMeasured = hookOverhead.before.count > 0 && hookOverhead.after.count > 0 && invalidTimings === 0;

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
      note: "Completed hook body wall time including awaited audit IO, excluding tool execution and Gateway scheduling. Bounded samples are emitted on the next proposal; the final process tail is not persisted. Not paired-call percentiles or semantic reviewer latency.",
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
