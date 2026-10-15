# SAR coverage and hook timing — 2026-10-15

## Baseline (not post-fix evidence)

Analysis boundary: `2026-10-12T14:07:48.500Z`. Snapshot generated at
`2026-10-15T23:09:35.075Z`:

- 2,294 proposals; 2,285 mature logical proposals
- 2,274 paired; 11 outcome_unknown (0.4814%); 99.5186% outcome accounting
- 51 unknown classifications (2.2232%)
- Zero duplicate proposals, schema drift, or non-shadow/enforced records

Volume and outcome-accounting gates pass; classification coverage does not.
This cohort has no semantic human labels and no production hook timing.

## Changes

- Explicit allowlisted aliases for observed OpenClaw tool names, including
  messaging, web/skill reads, identity, credentials, skill operations, agent
  control, and wait. Unknown names/actions remain conservative.
- Monotonic completed-hook timing, including awaited audit IO and excluding
  tool execution. Up to 128 samples are retained and emitted on the next
  proposal; overflow is counted and the final process tail is intentionally
  not persisted. No additional write is introduced just to record write cost.
- Reporter separates per-hook timing observations, loss/invalidity, and the
  still-unapproved production overhead budget. No automatic promotion.
- Normalizer rules version is now `shadow-3`.

Verification: 18/18 plugin tests, 9/9 policy tests, syntax checks and diff check
pass. Local paired-hook benchmark (200 iterations): p50 0.895 ms, p95 1.165 ms,
max 16.888 ms. These local measurements are not production evidence.

## Deployment status

Hot reload failed during drain: 11 retained work items did not settle within
60 seconds. Gateway explicitly reported generation 2 replacement not applied;
the old runtime remains active. A backed-up Gateway restart is the fallback.
Post-restart verification is pending; do not claim the fixes are live until a
fresh `shadow-3` canary and paired records are observed.

## Semantic gate

The old cohort cannot be retrospectively semantically labeled because its raw
recipient/content/authorization evidence was intentionally never stored.
Prospective isolated ephemeral reviews and independent human ground truth are
still required. Synthetic accuracy and corrected historical classifications
are not substitutes. SAR remains shadow-only; the envelope remains disconnected.
