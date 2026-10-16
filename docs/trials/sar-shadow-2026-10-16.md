# SAR scheduler outcome-hook correction — 2026-10-16

## Baseline and diagnosis

At 23:46:29Z, the shadow-3 cohort beginning at the confirmed Oct. 15 activation
contained 503 proposals / 493 mature logical proposals: 385 paired and 108
outcome_unknown (21.91%). Classifications, duplicates, schema, and mode were clean.
The traffic gate alone passed. This does not justify enforcement.

104 unknowns have periodic scheduled-check patterns (100 on a two-minute cadence
and four on a five-minute cadence); four other historical calls remain unresolved.
No historical unknown is reclassified as success. A later in-flight observation
is not included in these mature counts.

Installed OpenClaw 2026.10.3 scheduler source, `src/cron/trigger-script.ts`, compiled
in `server-cron-DO6g_stF.mjs`, calls pre-hook-wrapped tools from the script executor
without an after-tool hook. The generic before-hook wrapper emits diagnostics
but does not emit `after_tool_call`. Native harness and MCP paths have separate
post-hook bridges. This explains a structural observation gap for scheduler scripts.

## Correction

`patches/cron-outcome-hook.mjs` is an explicit, hash-pinned local compatibility
patch for that installed bundle, not a portable plugin API or upstream fix.
It calls the native after-hook helper once from a finally block around execution,
before result projection; actual tool errors and structured error results remain
errors. Projection/observer failures cannot replace the original execution result.
No tool permissions, policies, approvals, or SAR hook surfaces change.
Updates may replace the patched bundle: never blindly reapply to another version.

Nine targeted tests cover success, throw, throw-undefined, cancellation,
structured error, projection failure, observer failure, unsupported bundles, and admission refusal.
All pass, along with 18 plugin tests and nine policy tests. Patched bundle parses.
The test executor uses the exact callback emitted by the patch with controlled
native dependencies and the real SAR runtime/audit sink; raw canaries are absent.

## Deployment

Backup and undo script created before mutation (host-local paths retained privately).
Status: live-verified after deferred safe restart. Restart accepted at 23:49:53Z;
old process drained and was replaced without a forced restart. See recovery below.
Historical telemetry is preserved. Enforcement and semantic envelope remain off.

## Direct pre-restart reproduction

At 23:52:14Z a temporary disabled one-shot script job was manually run against
the old process. Scheduler returned `succeeded`; SAR emitted exactly one scheduler
exec proposal and zero matching actuals. That is direct proof of the scheduler
hook gap, independent of the periodic historical pattern. The job auto-deleted.
An earlier attempt failed before tool execution because `timeout` is unsupported;
using the documented `timeoutSeconds` succeeded. Neither attempt is traffic-gate
validation; these are diagnostic canaries only.

## Restart recovery and live verification

Gateway PID changed from 81642 to 32694 (process start 23:55:07Z). Health RPC
passed. Shadow activation logged at 23:55:49.287Z and again at 23:56:24.740Z;
the later timestamp is the conservative fresh analysis boundary. Runtime
inspection of `sylar-semantic-action-review` confirms loaded status, exactly
two typed hooks, zero capabilities/tools/services, no diagnostics, prompt
injection denied, and conversation access denied. An initial inspection used
the wrong short plugin ID and returned not-found; the canonical ID succeeded.
The installed bundle SHA-256 equals the patch's pinned output hash.

The retained disabled scheduler canary had no execution history, so it was run
once at 23:58:28Z. Scheduler completion was `succeeded` (744 ms). SAR recorded
exactly one scheduler exec proposal and one completed actual with the same
event ID, 512 ms apart. Raw command/output marker absent from the entire audit
file; audit directory/file modes 0700/0600. `enforced: false` on both records.
The manual-run path retained the disabled one-shot despite deleteAfterRun,
so it was explicitly removed and removal returned true. No child agents were
listed for recovery, and no replacement agents were started.

Nine targeted patch tests passed again after recovery. Earlier plugin and
policy validation remains 18/18 and 9/9 respectively; neither suite's source
changed in this continuation.

Snapshot at 2026-10-16T23:59:13.798Z (full redacted aggregate in `sar-shadow-2026-10-16-restart-report.json`): 29 proposals, 17 mature logical proposals, 17 paired; 0 outcome_unknown, 0 unknown classifications, 0 duplicate proposals, zero schema drift/non-shadow records.

Completed-hook p95: before 1.592 ms / after 24.895 ms; no timing drops/invalids. Samples are completed hook-body times, not tool durations or an approved latency budget; final timing tail is unpersisted.

Small smoke window only, including diagnostic traffic, not sustained production validation. Historical unknowns stay unknown; four non-periodic historical gaps remain unresolved. Next gates: >=500 fresh proposals with sustained outcome accounting, prospective independent human semantic labels, and evaluated production overhead budget. Enforcement remains off and the semantic envelope disconnected. This host-local compatibility patch may be replaced by OpenClaw updates; do not reapply to an unsupported bundle.
