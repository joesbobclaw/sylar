# Conversational email and event adapters

## Status

Proposed · Priority P2 · Source: Hermes Agent.

## Source behavior and gap

Hermes includes authenticated per-sender IMAP/SMTP conversations, SimpleX, ntfy, and Home Assistant state-change subscriptions. OpenClaw supports IMAP and Gmail automation paths plus send skills, but email is not generally a symmetric conversational channel. Other event sources are extensible through plugins and webhooks. This is a selective integration gap, not a core runtime gap.

## Outcome

Email and machine events can enter OpenClaw with stable conversation identity, verified origin, reply semantics, explicit routing, and bounded tools.

## Proposed design

Create one reusable `EventAdapter` contract and implement email first:

- authenticated source identity and trust metadata
- deterministic conversation-key grammar
- threading and reply target
- attachment normalization and size limits
- deduplication and replay protection
- source-specific acknowledgment semantics
- route, agent, model, and tool-policy selection
- outbound effect classification

Email uses Message-ID, References, sender authorization, and authentication results. Home Assistant and ntfy use signed subscriptions and stable event IDs.

## Trust and safety

- Treat message bodies, headers, and attachments as untrusted.
- Authentication does not imply authorization.
- Sending, subscribing, and acknowledging are separately classified effects.
- Never route personal mail to an implicit last-used destination.
- Quarantine malformed or oversized payloads.
- Preserve raw evidence outside model-visible context when needed for forensics.

## MVP

Email DMs for an allowlisted test account: authenticated ingress, per-sender thread, text plus safe attachments, explicit reply approval, dedupe, and audit.

## Acceptance tests

- Spoofed sender fails authorization despite a plausible From header.
- Duplicate delivery does not create duplicate turns or replies.
- Thread replies remain attached to the correct conversation.
- An attachment prompt injection cannot alter routing or tool policy.
- Outbound reply requires the configured approval class.
- Event adapters cannot silently reuse email credentials.

## Acquisition test

The ability is acquired when email behaves as a secure, threaded OpenClaw channel under the same identity, routing, policy, and audit contracts as other channels.
