# Publishable team-agent bundles

## Status

Proposed · Priority P1 · Source: Grok Bot Team Bots.

## Source behavior and gap

Grok Team Bots package a maintained agent with plugins, skills, files, team memory, bot-owned secrets, caller-scoped OAuth, private per-user conversations, and an optional Slack identity. OpenClaw can assemble agents, routes, skills, roles, SecretRefs, and multi-user sessions, but lacks one lifecycle object that publishes and governs the package. Partial/productized gap.

## Outcome

An organization can publish one governed agent for a job while keeping each user's conversation private and enforcing whether actions use the caller's identity or the agent's service identity.

## Proposed design

Define an `AgentBundle` manifest:

- identity, purpose, owner, maintainers, and version
- allowed models and tools
- required plugins and skill digests
- knowledge/file references and team-memory policy
- credential bindings labeled `caller`, `service`, or `none`
- channel identities and routing
- role map, data policy, retention, audit, and update channel

Publication validates dependencies, permissions, migrations, and conformance tests. Installation creates private user sessions referencing the same immutable bundle version. Updates are staged, diffed, canaried, and reversible.

## Trust and safety

- Never share one user's OAuth session with another.
- Bot-owned credentials expose capabilities, not values.
- Bundle authors cannot exceed the installing organization's ceilings.
- Team memory and private memory are separate stores with explicit promotion.
- Channel identity must make the acting agent clear.
- Every output and side effect records caller, bundle version, and credential mode.

## MVP

Local organization only: one bundle, two users, private sessions, shared read-only knowledge, caller-scoped GitHub OAuth, one service credential, and Slack routing.

## Acceptance tests

- Users cannot read each other's chats or private memory.
- Caller-scoped actions preserve caller attribution.
- Service-identity actions are labeled and audited.
- Updating a skill affects new turns only and can roll back.
- Removing a user revokes access without deleting shared team knowledge.
- Import rejects undeclared secrets or overly broad permissions.

## Acquisition test

The capability is acquired when a versioned agent package can be safely published to multiple users with private conversations, shared governed knowledge, and unambiguous caller-versus-service identity.
