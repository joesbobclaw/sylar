# Private human-review surface — 2026-10-18

## Verdict

BUILT, LOCAL SERVICE VERIFIED, DELIVERED BROWSER INTERACTION UNVERIFIED.
The platform browser policy rejected navigation to both Control UI and the exact
allocated private Portal URL. No alternate route or policy change was used to bypass
that denial. Private local Portal remains available for an owner hands-on synthetic
check; remote reachability is not established. **Real-action admission disabled.**
No prospective collection or independent human labels; no enforcement. Manual
copied effects are not automatic trusted live capture or proof of provenance.

## Implementation

`apps/review-pilot/` is a separate no-dependency Node HTTP application, not a live
SAR-plugin change. Exactly zero execution code paths for submitted effects.
The screen displays a prepared copy, requires independent judgement, then reveals
the separately sealed model result and discards the raw envelope before persisting
fixed metadata. Synthetic examples and automation labels are excluded from the real
cohort. Twelve prospective admissions maximum when enabled in a separately verified
run; category/operation matching, no arbitrary new categories.

Local isolated inference through the installed OpenClaw CLI entry uses the existing
configured model/auth, no agent/session bootstrap, tools, MCP, or agent runtime.
A stdin-only disposable worker prevents action contents in process arguments or
prompt files. It suppresses provider/CLI errors, bounds output and duration, and
is killed on expiry/cancellation. The model result is narrowed by deterministic
policy, never allowed to broaden structural authority. No synthetic provider call
or synthetic machine judgement is called independent human ground truth.

Private authentication uses bootstrap fragment, HttpOnly cookie, Origin and CSRF.
Portal credentials and host/process-specific details stay in ignored local state.
No raw body/request logs, caches, localStorage, IndexedDB or exports. CSP and text-only
rendering resist effect-content HTML injection. One raw envelope,256KiB maximum,
5-minute TTL; four bounded HTTP body slots protect intake memory. Raw provider input
still follows the configured provider's own retention policy, not a zero-retention
claim. Process/browser/OS forensic erasure and provider cancellation are not promised.

The client clears raw contents on label, expiry, pagehide and visibility loss;
server-side TTL/cancellation deletes the envelope and aborts the reviewer. A monotonic
remaining-time countdown avoids client/server clock skew. SIGKILL/crash tests leave
no local raw artifact or raw stdout/stderr. Service starts with core dumps disabled.
Metadata JSONL is0600 under0700; no raw details or provider rationale are persisted.
Crash can lose final aggregate counters; missing pending items cannot be inferred
labelled. New process starts a separate study and rotates cookie/CSRF/ingest secrets.

## Checks

- Twelve pilot tests (actual client script offline DOM tests, service and HTTP):
  blinding; delete-before-persist; no replay; category/size/capacity checks;
  synthetic-only/prospective gate; twelve-admission cap; structural floor;
  conservative reviewer failure; actual timer expiry; cancellation/shutdown abort;
  concurrent HTTP raw-body intake bound; unauthenticated read rejection; wrong Origin/CSRF rejection; no raw error echo;
  stdin rather than OS argv; SIGKILL non-persistence; text-only HTML handling;
  post-commit reveal; client expiry/visibility/pagehide cleanup.
- Twenty-three existing plugin/label-scorer regressions pass, unchanged live hooks.
- Syntax and diff checks pass. Initial test file creation used the wrong working
  directory and produced zero tests; this was detected and corrected before any
  passing-test claim. All counts here are discovered and executed tests.
- Live synthetic isolated model call succeeded; live HTTP→reviewer→blind view→label
  checks verify actual local endpoints, deletion and privacy-safe persistence.
  The retained redacted smoke receipt contains only engineered synthetic outcomes.
- Real browser rendering, iframe/new-tab interaction, remote reachability and real
  human independence remain unverified. Offline DOM/HTTP tests do not substitute
  for those checks. Both denied browser attempts are recorded as failures, not
  successful navigation or rendered app verification.

## Owner handoff

Control UI → Portals → **Sylar · Private review**. Try **Try a synthetic example**,
read the proposed action, select an independent decision, and confirm the comparison
appears with the raw action gone. Closing/hiding the page discards pending content.
This check uses synthetic data only. Keep bearer URLs private; no credentials are
sent to this Discord channel. Portal route is local without private ingress.

Once that delivered interaction is verified, admit a minimal prospective cohort
through the private manual surface, with a separate source/independence receipt.
Automatic live capture is a different integration, still disconnected. Promotion
still needs sustained shadow traffic, independent real labels and overhead-budget
assessment. No live config, plugin grants, standing rules or enforcement changed.

Rollback/launch state are ignored local files. Stop via `node apps/review-pilot/stop.mjs`,
then close its Portal in Control UI; the live SAR observer and historical audit stay
unchanged. See [application README](../../apps/review-pilot/README.md).
