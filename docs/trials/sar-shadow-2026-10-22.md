# Sustained shadow checkpoint — 2026-10-22

## Scope and mode

Exact analysis boundary: `2026-10-18T17:38:16.680Z`. Snapshot: `2026-10-23T04:35:19.393Z`.
No runtime, plugin, configuration, browser-policy, model grants or enforcement changes.
The private pilot still runs locally, but browser navigation remains policy-denied.
It stays synthetic-only. No independent human labels or real intake were enabled.

## Sustained outcomes

- 9,651 proposals, 9,641 mature logical calls; 9,637 paired (99.9585%).
- 4 mature outcomes remain unknown, never inferred successful. 16 recorded tool errors stay errors.
- 3 unknown classifications; zero duplicates/schema drift/non-shadow records.
- Traffic, >=99% accounting, <=1% duplicate/unknown classification, schema and shadow-only gates pass.
- Historical unknowns and older timing drops are preserved unchanged.

## Candidate latency assessment

- 11,896 before / 11,892 after samples; zero recorded drops/invalids.
- Conservative p95 bounds: before 40 ms, after 50 ms.
- The before p95 is in the (32,40] ms histogram bin, so it **fails** the documented candidate <=10 ms bound; this is not just rounding across10ms.
- The after p95 upper bound50ms meets the candidate <=50ms bound. This does not make the overall overhead gate pass.
- Candidate limits were chosen with previous observations visible, not independently preregistered/approved. No approval is manufactured or production promotion claimed.
- Daily aggregate timing shows the high-volume UTC Oct19 cohort dominates the aggregate. Dates describe persistence, not exact hook-execution date; no per-day pairing claims.
- Maxima around900ms disclose large tails; the final in-memory process tail remains unpersisted. Hook wall time includes awaited IO/event-loop wakeup delay; it is not CPU time, tool duration, or semantic-model latency.

## Isolated audit-writer diagnosis

Added `diagnostics/profile-audit-io.mjs` and `profile-fs.mjs`. The diagnostic loads the actual audit-sink source, replacing only its filesystem import with timed wrappers. The source SHA256 is retained; no copied/reimplemented writer algorithm or live audit mutation.
512 synthetic records per case at concurrency1/4/16/32; all2048 records, uniqueness,0700 directory/0600 file and expected filesystem API counts independently asserted by the script.
The production writer performs five awaited filesystem API operations per record: mkdir, directory chmod, stat, appendFile, file chmod. Underlying kernel operations inside each API are not separately counted.

- Concurrency1: append p95 0.423ms; average filesystem time/record 0.302ms; queue+JS residual 0.010ms.
- Concurrency4: append p95 1.297ms; average filesystem time/record 0.235ms; queue+JS residual 0.734ms.
- Concurrency16: append p95 5.333ms; average filesystem time/record 0.259ms; queue+JS residual 3.931ms.
- Concurrency32: append p95 8.482ms; average filesystem time/record 0.234ms; queue+JS residual 7.238ms.

This reproduces serialized-queue amplification but **does not reproduce or causally explain production40ms p95**. Current synthetic host load and instrumentation differ from the retained live cohort. Do not infer filesystem operations, queueing, normalization or event-loop contention alone caused the live tail.

No live optimization was applied. In particular, file permissions, awaited audit durability and outcome accounting were not weakened to manufacture a latency pass. Next engineering measurement is bounded production-stage attribution: normalizer/body time, sink-queue wait, filesystem stages, and event-loop wakeup effects, without parameter values or call identifiers. That instrumentation must be verified and deployed as a fresh observation boundary before claiming a root cause.

## Private UI reconciliation

The standalone app and its Portal are still active. Browser doctor initially found the managed browser stopped; supported start succeeded. A single current-Portal navigation was then rejected by browser policy. No alternate hostname, direct CDP, different driver or policy change was used to bypass it. No rendered/interactivity success is claimed.
The remaining human step is the private synthetic example in Control UI → Portals → Sylar · Private review, then confirmation that comparison appears and raw content disappears. Asking whether this was already completed does not assume a label or approval. Remote access remains unverified.

## Checks and conclusion

- 12 pilot/client/HTTP tests and23 plugin tests pass (35total); diagnostic syntax and source-import/record/mode assertions pass.
- Diagnostic code and redacted aggregate evidence only; no runtime mutation or new process restart.
- Semantic human labels remain missing; candidate before-hook overhead currently fails. Enforcement remains off.

Files: [sustained aggregate](sar-shadow-2026-10-22-report.json), [daily timings](sar-shadow-2026-10-22-daily-timing.json), [isolated IO profile](sar-audit-io-profile-2026-10-22.json).
