# Roadmap

## Phase 0 — Contracts and fixtures

Deliver:

- Shared schemas from the reference architecture
- Synthetic fixtures for email, files, connectors, browser actions, and agent handoffs
- Replay harness with deterministic fake tools
- Red-team corpus for prompt injection, confused deputy behavior, stale approvals, and cross-user leakage

Exit gate: the harness can replay the same proposed effect through deterministic policy, semantic review, approval, execution, and audit without touching a real account.

## Phase 1 — Safety substrate

Build:

1. Semantic action review
2. Restricted proactive research

Why first: every later autonomous feature increases the amount of unattended work. These two establish a narrower, inspectable boundary before autonomy expands.

Exit gate: zero unauthorized effects across the adversarial suite; all permitted effects produce stable, attributable decisions.

## Phase 2 — Learning substrate

Build:

1. Demonstration-to-skill compiler
2. Post-task learning loop
3. Learning journey

Exit gate: a demonstrated workflow produces a draft skill, passes replay evaluation, requires the configured review, and can be rolled back without affecting unrelated skills.

## Phase 3 — Coordination substrate

Build:

1. Durable agent task ledger and peer collaboration
2. Publishable team-agent bundles

Exit gate: three persistent agents can collaborate on one task, transfer ownership exactly once per transition, preserve caller-specific authority, and recover after restart without duplicate side effects.

## Phase 4 — Execution and research

Build:

1. Python tool programs
2. Trajectory lab
3. Persistent agent workspace profile

Exit gate: programs and workspaces remain subordinate to Gateway policy; exported trajectories pass redaction and provenance checks.

## Phase 5 — Distribution

Build selectively:

1. Conversational email and event adapters
2. Connector catalog and enterprise governance

Exit gate: each connector declares identity, scopes, effects, data handling, approval semantics, revocation behavior, and conformance-test results.

## Recommended first spike

Implement semantic review as a shadow-only Gateway hook over synthetic `ProposedEffect` fixtures. Measure disagreement with deterministic policy and human labels before allowing the reviewer to block or escalate real actions. Do not begin with live email or money movement.
