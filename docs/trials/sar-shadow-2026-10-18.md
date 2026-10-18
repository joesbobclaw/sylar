# SAR timing overflow repair — 2026-10-18

## Status

Prepared and locally verified; live activation still pending. Enforcement off.
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

Pending authorized lifecycle activation. Backup/undo and recovery details are in
the ignored host-local `patches/TIMING_LOCAL_DEPLOYMENT.json`. Preserve audit data.
After activation: verify health/process or runtime generation, exactly two hooks and
no new authority; fresh shadow-4 timingVersion2 canary paired/redacted,0700/0600,
zero recorded drops/invalids. Preserve prior smoke and historical unknown outcomes.
