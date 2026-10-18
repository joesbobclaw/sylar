# Sylar private review pilot

A standalone, loopback-only human-review surface. It never executes the copied
effect and never installs or modifies Gateway hooks/capabilities. It has no action
executor. It calls the existing configured model through **local isolated inference**,
not a chat agent, Gateway agent session, tools, MCP, or a subagent.

## Current delivery

A private Portal named **Sylar · Private review** is allocated in Control UI →
Portals. No bearer URL or login code belongs in a group message or this repository.
Real-action admission is **disabled** in the delivered launcher: browser navigation
was blocked by the platform policy, so delivered rendering remains unverified.
The human can try the synthetic example privately to verify the screen. Synthetic
labels never count toward real semantic accuracy. No human pilot has started.
Remote reachability is unverified; without private portal ingress, the allocated
route is a local-host preview, not remote hosting.

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

Allocate a Portal with port18794 before starting the server. Keep returned launch
URLs private. Write an ignored `.tmp/review-pilot/launch.json` containing a random
`bootKey` and the exact returned token-free `publicUrl`. `launch.mjs` reads them
without printing credentials. It sets `PORT`/`PUBLIC_URL`, binds only127.0.0.1, uses
the installed OpenClaw CLI module and the existing `openai/gpt-5.6-luna` model.
No new account, model permission, or Gateway config is granted.

```sh
ulimit -c 0
node apps/review-pilot/launch.mjs
```

For another installation, set the installed CLI module in `launch.mjs` or use
`OPENCLAW_CLI_MODULE` with `server.mjs`. Parent frame origin must match Control UI;
if different-site cookie/embedding is blocked, use its private Portal new-tab launch.
No DNS/ingress/auth changes are made by this application.

```sh
node apps/review-pilot/stop.mjs
```

Stop checks the recorded process identity before signaling. Close its Portal in
Control UI to withdraw the proxy route; stopping the app alone leaves a waiting
route, not a running raw-data service. The Gateway SAR observer is unchanged.
Restart starts a new study/file, drops all pending raw data and rotates session/
CSRF/ingest credentials. Stored metadata from prior runs is kept separate. A crash
can lose final aggregate counters; do not infer missing pending items were labelled.

## Verification

`npm --prefix apps/review-pilot test` tests the actual client script in an offline
DOM harness, service lifecycle and HTTP boundaries. This does not substitute for
rendered-browser verification. See `docs/trials/sar-review-pilot-2026-10-18.md`.

The production launcher's synthetic-only gate must remain off for real values until
the private delivered screen has passed a hands-on check. The live observer remains
fully disconnected from this manual ingestion service. Connecting automatic
prospective capture is separate work requiring trusted normalization/consent context;
manual copies alone do not prove authentic live provenance.
