# Sylar Semantic Action Review plugin

An OpenClaw plugin that observes real tool-call hooks and writes privacy-minimized JSONL telemetry for later SAR evaluation.

## Current mode

**Shadow-only.** Both hooks return `undefined`. The plugin cannot block a call, rewrite parameters, request approval, or expand authority.

The plugin records consequential calls by default. Known reads are skipped unless `includeReads` is enabled. Unknown tools are treated as review candidates.

## Privacy boundary

Audit records contain tool names, classifications, parameter counts/types/lengths, requester proof flags, counts, and process-salted correlation fingerprints. They do not contain:

- parameter or result values;
- parameter or result object key names;
- prompts, messages, commands, patches, URLs, queries, or file paths;
- recipient, sender, role, session, run, or tool-call identifiers;
- error text.

The audit directory and file are forced to modes `0700` and `0600`. Writes stop at 50 MiB rather than growing without a bound.

Schema version 2 records both the proposed tool name and the tool name observed
after execution because OpenClaw may normalize aliases between the two hooks.
Older schema version 1 telemetry can remain in the same append-only log.

## Configuration

```json
{
  "enabled": true,
  "auditPath": "/absolute/path/to/sar-shadow.jsonl",
  "includeReads": false
}
```

Default audit path: `~/.openclaw/audit/sar-shadow.jsonl`.

## Verify

```sh
npm test
npm run check
npm run report
npm run benchmark
openclaw plugins inspect sylar-semantic-action-review --runtime --json
```

To isolate a deployment window from older records:

```sh
node scripts/analyze-shadow.mjs ~/.openclaw/audit/sar-shadow.jsonl --since=2026-10-11T06:35:00Z
```

The report deliberately stays fail-closed. It checks logical pairing, duplicate
hook delivery, unknown-tool coverage, schema drift, shadow-only invariants, and
sample size. Tool execution duration is reported separately and must not be
misrepresented as SAR hook overhead; the local benchmark measures the plugin's
own paired audit path.

Every mature logical proposal is assigned one outcome-accounting state:
`completed`, `error`, or `outcome_unknown`. A missing post-hook is always
`outcome_unknown`; it is never inferred to be successful. Enforcement remains
blocked if more than 1% of mature logical proposals have unknown outcomes.

Expected runtime surface: exactly two typed hooks (`before_tool_call` and
`after_tool_call`), with prompt injection and conversation access denied.

## Rollback

Disable without deleting the audit log:

```sh
openclaw plugins disable sylar-semantic-action-review
openclaw gateway restart
```

The Bob deployment also has a pre-install backup and an operator-local undo
script. These machine-specific paths are intentionally not committed here.

No enforcement should be added until sustained shadow data is labeled and the false-negative, false-positive, latency, and redaction gates in the ability specification pass.

## Ephemeral review envelope

`src/ephemeral-review-envelope.js` implements the disconnected safety-gate
component for future semantic labeling. It holds raw action values only in
memory, with defaults of 100 concurrent envelopes, 256 KiB per envelope,
8 MiB total, and a five-minute hard TTL. Admission fails closed. Envelopes are
deleted on completion, cancellation, expiry, or shutdown; process failure loses
them by design. Only fixed label/status/latency metadata is returned for
possible durable logging.

The envelope is deliberately **not wired into the live hooks yet**. The plugin
remains shadow-only and behaviorally unchanged until the envelope tests and a
separate reviewer-isolation review pass.

## Completed-hook timing (shadow-4)

Known OpenClaw aliases are matched against an explicit allowlist. Unknown names
and unknown mutating actions remain review candidates; credential operations
and agent control are action-sensitive.

Every hook body is timed with a monotonic clock, including awaited audit IO.
Two fixed-size histograms (33 counters per phase plus exact maxima) retain every
completed measurement until the next recorded proposal under `observer`. Read-only
bursts cannot exhaust a sample list. Percentiles are conservative histogram upper
bounds, not exact quantiles. Legacy sample reports stay readable and historical
drops remain recorded; never mix old drops into a claimed clean post-fix window.
The final process tail is intentionally lost. This avoids a recursive second
write just to record the cost of the first one. Measurements exclude Gateway
scheduling and tool execution; they are per-hook, not paired-call percentiles
or semantic-model latency. The report keeps observation separate from an
approved latency budget and never promotes automatically.

A frozen redacted historical cohort cannot be retroactively semantically
labeled: the required recipient/content/authorization evidence was never
stored. Future representative labels must be collected prospectively through
the ephemeral envelope with an isolated reviewer and human ground truth.
Neither relabeling old classifications nor synthetic fixture accuracy closes
that gate.

## Human-label pilot preparation

See [prospective pilot v1](../../docs/trials/sar-human-label-pilot-v1.md).
`npm run labels --silent < PRIVATE_METADATA.jsonl` scores only fixed metadata,
excludes synthetic/nonindependent rows, and discloses failures and disagreement.
It does not collect raw effects or human labels, prove source independence, or
close any promotion gate. The authenticated private collection surface and separate
reviewer adapter are still unwired. No new live capabilities are registered.
