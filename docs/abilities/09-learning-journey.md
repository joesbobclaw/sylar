# Learning journey

## Status

Proposed · Priority P1 · Source: Hermes Agent.

## Source behavior and gap

Hermes presents a timeline and graph of learned memories and skills and allows users to inspect, prune, and correct them. OpenClaw exposes memory, wiki, Skill Workshop, transcripts, and audit separately. The missing feature is a unified provenance view of how behavior changed. Productized observability gap.

## Outcome

Users can answer: What did the agent learn? From which evidence? Where is it used? What changed because of it? Can I undo it safely?

## Proposed design

Build a derived graph over existing evidence:

- nodes: sessions, tasks, corrections, memories, skills, proposals, rules, evaluations, and publications
- edges: derived-from, supersedes, contradicts, evaluated-by, used-in, and invalidated-by
- views: chronological journey, dependency graph, recent changes, stale learning, and high-impact rules
- actions: inspect source, correct, forget, quarantine, roll back, or re-evaluate

The graph is a projection, not a second source of truth. Managed objects retain their native stores and identifiers.

## Trust and safety

- Respect original visibility and user boundaries.
- Redact source excerpts according to current policy.
- Deleting a graph node invokes the owning subsystem; it does not merely hide the visualization.
- Derived knowledge displays uncertainty and conflicts.
- Rollback previews downstream effects before mutation.

## MVP

Read-only Control UI timeline for memories, Workshop proposals, published skills, and explicit corrections. Add provenance links and stale-source warnings before mutation controls.

## Acceptance tests

- Every displayed learning node resolves to an authoritative source record.
- Private sources remain invisible to unauthorized viewers.
- Superseded skills show version lineage.
- Forgotten sources flag dependent learning for review.
- The UI distinguishes model inference from human correction.
- Timeline rebuild is deterministic from source records.

## Acquisition test

The capability is acquired when users can trace and govern behavioral changes across memory and skills from one provenance-preserving view.
