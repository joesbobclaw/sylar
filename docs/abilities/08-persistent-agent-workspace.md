# Persistent agent workspace profile

## Status

Proposed · Priority P1 · Sources: Grok Bot and OpenAI Dots.

## Source behavior and gap

Grok Bot and Dots productize managed cloud computers that retain files, browser state, apps, and work across conversations. OpenClaw has persistent paired hardware and durable Gateway state, while Crabbox workers are disposable by design. The missing capability is a supported managed workspace profile with durable user state and rebuildable compute. This is mainly a managed-service/product gap.

## Outcome

An agent can keep a durable workspace and signed-in browser across tasks without binding reliability to the user's laptop or treating an ephemeral worker as durable storage.

## Proposed design

Separate state into:

- encrypted durable volume for declared workspace files
- brokered browser profile and saved-login service
- immutable machine image and package manifest
- disposable compute instance
- Gateway-owned transcript, identity, policy, secrets, and audit

On wake, provision compute, attach the durable volume, hydrate the declared browser profile, attest the image, and issue short-lived capabilities. On sleep, reconcile files, close sessions, revoke capabilities, and snapshot metadata.

Support isolation modes: per agent, per user, or explicitly shared team workspace. Never make sharing an accidental consequence of colocating agents.

## Trust and safety

- Model-paused secure sign-in where supported.
- Password values never enter model context.
- Durable state is encrypted and independently revocable.
- Workspace sharing is explicit and visible.
- Uncommitted application state is treated as replaceable unless declared durable.
- Compromise of compute cannot modify Gateway policy or audit.

## MVP

One Linux desktop profile backed by encrypted durable storage, persistent Chromium profile, suspend/wake, human takeover, and disaster rebuild from image plus volume.

## Acceptance tests

- Files and browser sessions survive compute replacement.
- Secrets remain unavailable to the model and worker filesystem where brokered login exists.
- User A cannot mount or address user B's volume.
- A corrupted machine rebuilds without losing declared durable state.
- Suspend revokes live capabilities and stops compute billing.
- Shared-workspace mode visibly warns that all member agents can access shared state.

## Acquisition test

The capability is acquired when disposable compute can provide a durable, inspectable agent workspace whose state, credentials, isolation, and recovery are managed as first-class OpenClaw resources.
