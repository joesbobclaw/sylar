# SAR shadow trial — 2026-10-11

## Scope

This trial validates the collector only. The plugin remains shadow-only and
cannot block, approve, rewrite, or execute a tool call.

## Contaminated baseline

The initial schema-v2 stream revealed two collector defects:

- 55.4% of proposals were classified as unknown, primarily OpenClaw wrapper
  aliases and internal status tools.
- 28.9% of mature proposals were duplicate wrapper/inner hook observations.

Those figures must not be used as post-fix performance.

## Corrective deployment

- Gateway process boundary: `2026-10-11T06:35:22Z`
- OpenClaw Gateway PID at verification: `6681`
- Aliases observed in real traffic are now classified explicitly.
- Wrapper/inner events with the same tool-call ID are deduplicated.
- Reports support an exact `--since` deployment boundary.
- Nested object-shape metadata is included in the schema allowlist.

## Post-fix evidence

At the first mature-window check:

- Mature logical proposals: 12
- Logical pairing: 100%
- Duplicate proposal rate: 0%
- Unknown classification rate: 0%
- Invalid non-shadow/enforced records: 0
- Schema drift: 0
- Local paired audit benchmark (200 iterations): p50 1.46 ms, p95 21.29 ms
- Plugin tests: 9/9

This is a smoke test, not enough traffic for promotion.

A later snapshot contained 23 mature logical proposals with 22 paired (95.7%).
The unpaired event was a failed inner `exec` call: OpenClaw emitted
`before_tool_call` but no matching `after_tool_call`, while its outer Gateway
wrapper paired normally. SAR does not synthesize a successful result for this
case. The collector needs an explicit `outcome_unknown` timeout state, and the
promotion metric must distinguish completed/error results from missing-hook or
restart outcomes.

## Verdict

**NOT READY FOR ENFORCEMENT.** Remaining gates:

1. At least 500 post-fix proposals.
2. Human semantic labels over representative consequential actions.
3. A production latency measurement/attestation rather than only the local
   filesystem benchmark.
4. Continued >=99% logical pairing, <=1% duplicates, <=1% unknowns, zero
   schema drift, and zero authority expansion across the full sample.
5. Explicit accounting for pre-hooks that never receive a post-hook; do not
   relabel them as completed merely to improve pairing.

The redacted audit stream alone cannot support semantic human labeling because
it intentionally excludes recipients, content, paths, and commands. The next
design step is a bounded, ephemeral review envelope whose raw values never enter
the JSONL audit log.
