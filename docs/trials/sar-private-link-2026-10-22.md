# Direct private review link — 2026-10-22

## Delivered outcome

The review screen now opens from a private HTTPS link, without Control UI, a Portal,
a new account, or dashboard navigation. A fresh link was delivered privately to
the requesting owner after browser verification and credential rotation. No bearer
URL, login credential, recipient identity or messaging IDs are stored here.

The existing HTTPS host forwards only `/sylar/` to the loopback review backend.
Its original root response SHA256 is unchanged. No DNS, tunnel config or Cloudflare
Access policy changed. A candidate demo hostname was found to serve a different
site; an attempted no-overwrite route check returned an existing-record error, so
it was not repointed. An existing working shared host was used instead.

Protection is application-level one-use login and expiring HttpOnly/Secure/
SameSite=Strict session, not a Cloudflare Access login wall. All reads and writes
also require the in-memory view/CSRF header; cookie alone does not expose action
content or that header. Host forwarding strips unrelated cookies and only permits
the dedicated prefix. No unrelated task-board API or stored data was changed.

This shared-origin route is a **synthetic-only engineering demo**, not a declaration
of separate-origin isolation for sensitive real data. Prospective intake remains
disabled; automatic live capture stays disconnected; enforcement stays off.

## Actual browser verification

Using the published HTTPS route in a managed Chrome browser:

1. Fresh login loaded the screen and removed its fragment credential.
2. Clicked **Try a synthetic example**. The wrong-recipient copied effect became
   visible, with all four judgement choices; comparison remained hidden.
3. Submitted an automation judgement (synthetic, excluded—not human ground truth).
4. The screen displayed `You: deny. Reviewer: deny. Agreement.`
5. DOM and screenshot confirmed comparison visible, raw effect empty, review hidden,
   and the fragment absent. This is delivered browser interaction, not just HTTP200.
6. Rotated the test credential and restarted only the pilot before private delivery.
   The recipient received a fresh, unused link, expiring30 minutes after issuance;
   authenticated sessions expire after30 minutes and re-entry never extends expiry.
7. After rotation, unauthenticated action requests still401; shell/assets200 and
   the shared host's original root hash unchanged. No new credential was consumed
   by post-delivery checks.

The first browser reuse after a backend restart retained stale page state; this
produced a rejected request, not a successful flow. A clean navigation verified the
new session. The client was then fixed to handle hash-only private-link navigation
in an already-open tab, with a regression test. No browser navigation policy was
changed: the old local Portal URL remained denied; the newly authorized HTTPS app
route was accessible normally.

## Engineering checks

- 16 pilot/client/HTTP tests +23 existing plugin tests pass (39total).
- New coverage: prefixed assets/API routes; scoped secure cookie; one-use/expired
  links; expired sessions; cookie-only read rejection; new fragment reauthentication.
- Syntax/diff and staged-credential checks pass. No runtime SAR code/model grants
  changed. No real action executed and no independent human label collected.
- An immediate host-service readiness probe ran before its restart completed and
  failed connection; the later successful probes and unchanged root hash are the
  retained recovery evidence. No repeated tunnel/Gateway restart was used.
- Initial screenshot CLI flag was unsupported; corrected positional invocation
  succeeded and the resulting comparison screenshot was visually inspected locally.

## Deployment and rollback

`deploy/task-board-sylar-mount.patch` records the exact two-line host integration,
mounted before its JSON parser. The host already had unrelated local edits; those
were preserved and not committed as part of Sylar. Its service was restarted once
and existing root content was reverified. The obsolete local Portal was closed.

Private bootstrap/runtime files, delivery receipt and timestamped backup/undo paths
stay in ignored host-local state. Stop the pilot and remove the backed-up host mount
to withdraw access; no DNS change needs undoing. The one-time link and session expire
server-side even if the browser stays open. A fresh link can be issued without any
new account or public credential sharing.

See [redacted checks](sar-private-link-2026-10-22-checks.json) and
[application README](../../apps/review-pilot/README.md).
