# Sylar private review pilot

A standalone, loopback-only human-review surface. It never executes the copied
effect and never installs or modifies Gateway hooks/capabilities. It has no action
executor. It calls the existing configured model through **local isolated inference**,
not a chat agent, Gateway agent session, tools, MCP, or a subagent.

## Current delivery

Standalone private HTTPS access is deployed at the existing shared host's `/sylar/`
path. No Control UI, Portal, new account or dashboard navigation is required.
The login link is delivered privately; keep its fragment credential out of group
messages, source control and screenshots. Fresh links are single-use, expire after
30 minutes, and establish a 30-minute HttpOnly/Secure/SameSite=Strict session.
Reopening a link with its still-valid session is permitted but never extends expiry.
All authenticated reads as well as writes require the in-memory CSRF/view header;
a cookie alone cannot read effect data or retrieve that header. Frame embedding is
blocked, and other cookies on the shared host are not forwarded to the backend.

Real-action admission remains **disabled**. Only a synthetic engineering example is
available; no human pilot or real-data study has started. This shared-host demo is
not a claim of separate-origin isolation for future sensitive real-action intake.
No DNS, Cloudflare Access policy, or tunnel configuration was changed. Protection
is the application's one-time credential and expiring session, not an edge login.

## Security and lifecycle

- Per-process authentication: private bootstrap fragment immediately removed by
  `history.replaceState`, then an HttpOnly cookie; unsafe requests need CSRF plus
  matching Origin. The Portal has its own separate bearer boundary as well.
- One active raw envelope, <=256 KiB, <=5-minute TTL; twelve maximum prospective
  admissions when separately enabled after verification. Only allowlisted categories
  with matching operation kinds are accepted. Synthetic and prospective cohorts
  are marked explicitly, not guessed from content.
- The human sees the exact effect copy sent to the reviewer; no model decision,
  explanation or status is sent to the browser before the human commits. The
  reviewer decision is bounded by the deterministic floor. This is the combined
  review system's decision, not an unmodified semantic-model-only metric.
- Raw values stay in local process/browser memory, aside from sending the minimum
  effect to the configured model provider under that account's retention policy.
  This application cannot promise provider-side zero retention. No prompt in OS
  argv: stdin feeds a disposable worker; no shell commands are constructed from
  effect data. No per-effect inference session/transcript or app logging.
- Timeout/expiry/cancel/shutdown abort and kill inference; failures are disclosed,
  never counted as accurate decisions. Structural denial cannot become allow.
- On label, raw envelope is removed before metadata persistence. On pagehide or
  visibility loss, the client clears raw text immediately and requests cancellation;
  TTL remains the server fallback. The browser uses a monotonic countdown rather
  than trusting synchronized client/server clocks. Cached page restore has no raw
  contents. No localStorage, IndexedDB, service worker, raw export or autosave.
- HTTP cache disabled, no response/request-body logging, strict CSP and text-only
  rendering. Auth rejects reads before returning any action. No credential values,
  provider error messages, effect data or free-text rationale in JSONL/errors.
- `launch.mjs` must be started with `ulimit -c 0` (core dumps disabled); no raw crash
  reporting. Deletion means removal of live references, not forensic secure erasure.
  SIGKILL testing found no raw output/artifacts; OS swap/browser internals/provider
  retention are not under this application's control.
- Metadata is allowlisted by the existing label scorer. State directory 0700,
  labels/report/runtime files 0600. Runtime file contains authentication secrets
  and is ignored by git. Only aggregate reports belong in version control.
- Human independence/source are operator attestations, not cryptographic proof.
  The acting model cannot supply human truth. Automation test labels are synthetic
  and excluded. This pilot does not clear enforcement or latency gates.

## Run and stop

Use the existing shared HTTPS host with the dedicated prefix mount in
`deploy/task-board-sylar-mount.patch` (before its JSON parser). It forwards only that
prefix to the loopback18794 backend; all existing host routes remain unchanged.
Write an ignored `.tmp/review-pilot/launch.json` containing a fresh random `bootKey`
and its HTTPS `publicUrl` ending in `/sylar/` (no secret in that public URL). `launch.mjs` reads them
without printing credentials. It sets `PORT`/`PUBLIC_URL`, binds only127.0.0.1, uses
the installed OpenClaw CLI module and the existing `openai/gpt-5.6-luna` model.
No new account, model permission, or Gateway config is granted.

```sh
ulimit -c 0
node apps/review-pilot/launch.mjs
```

For another installation, set the installed CLI module in `launch.mjs` or use
`OPENCLAW_CLI_MODULE` with `server.mjs`. The standalone screen does not allow embedding. A fresh link contains only its
bootstrap credential in the fragment, which the client removes immediately;
hash-only navigation in an already-open tab explicitly reauthenticates.
No DNS/ingress/auth changes are made by this application.

```sh
node apps/review-pilot/stop.mjs
```

Stop checks the recorded process identity before signaling. Remove the host-local prefix mount (or apply its backed-up rollback) to withdraw
the HTTPS path. Stopping the app alone leaves a502, not a running raw-data service. The Gateway SAR observer is unchanged.
Restart starts a new study/file, drops all pending raw data and rotates session/
CSRF/ingest credentials. Stored metadata from prior runs is kept separate. A crash
can lose final aggregate counters; do not infer missing pending items were labelled.

## Verification

`npm --prefix apps/review-pilot test` tests the actual client script in an offline
DOM harness, service lifecycle and HTTP boundaries. This does not substitute for
rendered-browser verification. See `docs/trials/sar-private-link-2026-10-22.md` for actual rendered HTTPS checks
and `docs/trials/sar-review-pilot-2026-10-18.md` for historical implementation checks.

The production launcher remains synthetic-only. Rendered synthetic browser
verification is complete, but real intake still needs a separately authorized,
provenance-backed human cohort and isolation suitable for real action data. The live observer remains
fully disconnected from this manual ingestion service. Connecting automatic
prospective capture is separate work requiring trusted normalization/consent context;
manual copies alone do not prove authentic live provenance.
