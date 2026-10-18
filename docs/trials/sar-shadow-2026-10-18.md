# SAR timing overflow repair — 2026-10-18

## Status

Live shadow-4 activation verified after the deferred safe restart. Enforcement off.
Human-label pilot protocol and scorer prepared, not started; private collection
surface/reviewer adapter remain unwired. No raw live actions are being collected.

## Diagnosis and change

The old timing wrapper measured all hooks (including omitted read-only calls),
but only drained 128 samples on recorded consequential proposals. Sustained reads
therefore exhausted the list. Historical drops remain counted in the retained
pre-histogram report, not rewritten or treated as successful measurements.

`shadow-4` uses two fixed-size 33-bin histograms plus exact maxima and an invalid
clock counter. Every completed hook increments one bin, including errors, omitted
reads, and duplicate hook observations. No additional audit writes are introduced.
Measurements include awaited audit IO, exclude execution and Gateway scheduling;
bookkeeping after the timer stops is not part of the hook-body measurement.
Histograms drain once into the next consequential proposal. The in-flight hook
and final process tail remain memory-only; restart/failure tails cannot be inferred.
This fixes buffer-capacity loss, not failed audit writes or unpersisted tails.

The analyzer reports conservative percentile upper bounds and exact maxima, merges
legacy samples without double-counting, preserves historical dropped counts, and
rejects invalid timing formats as usable timing evidence. Empty denominators stay
unknown. Budget and label gates remain false.

## Verification

- 23/23 plugin tests, syntax checks, diff checks pass.
- A 1,000-read burst retains exactly 1,000 before +1,000 after measurements in fixed
  space; reads still create no audit records and their values never enter JSONL.
- Clock reversal, malformed/unknown histogram formats, boundary/overflow percentiles,
  legacy mixing, drop retention, error propagation and same-tool behavior covered.
- Local 200-pair benchmark p50 0.668 ms /p95 1.160 ms /max16.285 ms. This is not
  production latency and does not clear the production overhead gate.
- Initial test edit command used the wrong working directory and failed to update
  tests; corrected before the complete passing run. No live deployment occurred.

## Human labels

See [prospective pilot v1](sar-human-label-pilot-v1.md). Twelve-action pilot is
prepared for collection-mechanics review only. Scorer rejects arbitrary/raw fields,
excludes synthetic/nonindependent rows, exposes reviewer failures, four-way confusion,
unsafe allows and unnecessary friction. Human/source flags are attestations, not
proof; no synthetic score or metadata file alone closes the real-label gate.
Candidate observer limits (not approved): p95 <=10ms before /<=50ms after, chosen
with prior observations visible. Need sustained fresh data and a separate budget
assessment; no retrospective preregistration or promotion claim.

## Live verification

Deferred restart completed without another restart request or force. Health RPC
passed and the Gateway process changed. Startup logged SAR activation at
2026-10-18T17:37:37.490Z and again at 17:38:16.680Z; the later exact timestamp
is the conservative analysis boundary. Every selected proposal is shadow-4 with
observer.timingVersion 2. Runtime inspection confirms exactly before_tool_call
and after_tool_call, zero capabilities/tools/services/diagnostics, prompt injection
and conversation access denied.

A harmless read-only command through live gateway_exec returned its expected
marker unchanged. Its single proposal and completed actual share an event ID;
the proposed/observed alias difference is retained. Marker absent from the full
JSONL; directory/file modes 0700/0600. Raw marker, event ID and process details
are retained only in the ignored host-local manifest. No configuration changed.
The scheduler bridge still matches its pinned patched hash; its prior once-only
live canary evidence is preserved, not repeated for an unchanged bridge.

Snapshot 2026-10-18T17:41:53.002Z: 43 proposals, 42 actuals, 28/28 mature logical
outcomes completed/paired; zero unknown outcomes/classifications, duplicates,
schema drift or enforced records. Immature proposals remain outside mature
accounting, not inferred successful. Timing has 70 samples per phase, zero drops
or invalids; conservative histogram p95 upper bounds before 3ms /after 12ms.
See [aggregate report](sar-shadow-2026-10-18-post-histogram-report.json).

Small smoke only, including diagnostic and unrelated concurrent traffic; fewer
than 500 fresh proposals. Historical missing outcomes, 304 timing drops in the
pre-histogram report, and unresolved earlier cases remain unchanged. Histogram
process tails remain unpersisted. No sustained or overhead-budget conclusion.
Semantic-label and overhead-budget gates remain false. Human-label pilot protocol
and metadata scorer are PREPARED only: private collection surface/model adapter
not built or live; no human labels; semantic envelope disconnected.
