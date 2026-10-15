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
the old runtime remained active until the backed-up Gateway restart below.

## Semantic gate

The old cohort cannot be retrospectively semantically labeled because its raw
recipient/content/authorization evidence was intentionally never stored.
Prospective isolated ephemeral reviews and independent human ground truth are
still required. Synthetic accuracy and corrected historical classifications
are not substitutes. SAR remains shadow-only; the envelope remains disconnected.

## Restart recovery and live verification

Gateway PID 81642 started at 23:14:46Z; plugin activation was logged at
`2026-10-15T23:15:32.274Z`. First fresh `shadow-3` proposal was recorded at
23:16:55.667Z. No active/recent child runs required recovery. No restart was
replayed during recovery.

Runtime inspection with `--runtime` reports exactly `before_tool_call` and
`after_tool_call`, no diagnostic errors, no tools or additional authority,
and denied prompt-injection/conversation access. Inspection without
`--runtime` is discovery-only and reports zero hooks; it is not live-hook proof.

Snapshot generated at `2026-10-15T23:19:28.892Z`, using the activation boundary:

- 39 proposals; 26 mature logical proposals; 26/26 paired/completed.
- Zero mature unknown outcomes, unknown classifications, duplicate proposals,
  schema drift, or non-shadow/enforced records.
- 84 before-hook timing samples: p50 0.179 ms, p95 3.052 ms, max 17.236 ms.
- 84 after-hook timing samples: p50 0.525 ms, p95 25.184 ms, max 34.939 ms.
- Zero dropped or invalid timing samples. These are per-hook wall times, not
  paired-call percentiles or semantic-model latency; final-tail loss still applies.
- A fresh Gateway command/output canary paired successfully and was absent
  from the audit JSONL. Audit directory/file permissions remain 0700/0600.

An initial recovery query beginning at 23:14Z straddled plugin activation and
included one older unknown outcome. It is not the post-activation cohort;
older unknowns remain in the full audit and were not relabeled as successes.
Two exploratory shell lookups failed because `rg` was absent from the Gateway
shell PATH; filesystem/Python inspection completed the checks instead.

Verdict: deployment verified, **NOT_READY_FOR_ENFORCEMENT**. Remaining gates:
at least 500 fresh proposals, prospective independent semantic human labels,
and an evaluated production overhead budget. Do not manufacture traffic or
infer semantic accuracy from redacted telemetry. Envelope remains disconnected.
