# Sylar

Sylar is a source-backed capability acquisition plan for OpenClaw.

The project studies useful behavior in other agent systems, separates real capability gaps from marketing or near-equivalents, and writes implementation-ready specifications for the pieces worth bringing into OpenClaw.

The name comes from *Heroes*. We are keeping the capability-acquisition premise and skipping the brain removal.

## Rules of acquisition

1. Copy outcomes, not branding or proprietary implementation details.
2. Prefer an OpenClaw-native primitive over a brittle imitation of another product's UI.
3. Preserve OpenClaw's Gateway-owned authority, SecretRefs, auditability, and explicit trust boundaries.
4. A capability is not acquired until it has adversarial tests, failure behavior, and operator-visible evidence.
5. Productized differences are labeled **partial gaps**; they are not presented as missing primitives.

## Current target

Baseline: **OpenClaw 2026.9.1**, reviewed 2026-10-09.

Source systems:

- Nous Research Hermes Agent
- xAI Grok Bot
- OpenAI Dots

## Capability portfolio

### Build first

1. [Semantic action review](docs/abilities/01-semantic-action-review.md)
2. [Restricted proactive research](docs/abilities/02-restricted-proactive-research.md)
3. [Demonstration-to-skill compiler](docs/abilities/03-demonstration-to-skill.md)
4. [Persistent agent collaboration](docs/abilities/04-agent-collaboration.md)
5. [Post-task learning loop](docs/abilities/05-post-task-learning.md)

### Build after the safety substrate

6. [Publishable team-agent bundles](docs/abilities/06-team-agent-bundles.md)
7. [Python tool programs](docs/abilities/07-python-tool-programs.md)
8. [Persistent agent workspace profile](docs/abilities/08-persistent-agent-workspace.md)
9. [Learning journey](docs/abilities/09-learning-journey.md)
10. [Trajectory lab](docs/abilities/10-trajectory-lab.md)

### Integrate selectively

11. [Conversational email and event adapters](docs/abilities/11-conversational-event-adapters.md)
12. [Connector catalog and enterprise governance](docs/abilities/12-connector-governance.md)

## Start here

- [Evidence baseline](docs/evidence-baseline.md)
- [Reference architecture](docs/architecture.md)
- [Roadmap](docs/roadmap.md)
- [Specification template](docs/spec-template.md)

## Status

This repository contains specifications, not production code. Each ability has an explicit maturity state and a falsifiable acquisition test. The first implementation target is semantic action review because it becomes safety infrastructure for nearly every later capability.

## License

MIT. Source-product names and trademarks belong to their respective owners.
