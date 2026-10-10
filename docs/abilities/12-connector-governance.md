# Connector catalog and enterprise governance

## Status

Proposed · Priority P2 · Source: OpenAI Dots.

## Source behavior and gap

Dots advertises thousands of managed app integrations and specialist agents with distinct identities, credentials, IT-managed hardware, and Microsoft Agent 365 governance. OpenClaw is highly extensible through plugins, MCP, skills, roles, secrets, nodes, and fleet cells, but lacks a large managed catalog and one enterprise governance plane. Product and ecosystem gap.

## Outcome

Organizations can discover connectors, understand their real authority, install them safely, assign them to governed agents, and continuously verify that access matches policy.

## Proposed design

Do not chase a raw connector count. Define a conformance model first:

- publisher and package provenance
- supported resources and normalized effects
- OAuth/service identity modes and scopes
- read-only semantics and hidden side effects
- SecretRef and egress requirements
- data residency, retention, and subprocessors
- approval and idempotency behavior
- revocation, offboarding, and audit export
- test results and maintenance status

Add organization policy objects for allowed publishers, scopes, regions, models, devices, agents, and data classes. Connectors receive an installation risk report and must pass automated contract tests before use.

## Trust and safety

- Least-privilege scopes and incremental consent.
- Organization ceilings override agent and user choices.
- Caller identity and service identity remain distinct.
- Revocation invalidates sessions and cached capabilities.
- Connector updates cannot silently add effects or scopes.
- Catalog popularity is never treated as security evidence.

## MVP

Govern five existing connectors through a shared manifest and conformance suite. Provide install diff, scope review, identity mode, revocation test, and audit export.

## Acceptance tests

- Update adding a scope is blocked pending review.
- Removing a user revokes caller-scoped access.
- Service credentials cannot be exercised by an unauthorized agent.
- Read-only claims are verified against actual API behavior.
- Egress to undeclared hosts fails.
- Audit can attribute every effect to user, agent, connector version, and credential mode.

## Acquisition test

The capability is acquired when connectors are governed by enforceable identity, scope, effect, provenance, update, and revocation contracts—not merely listed in a marketplace.
