# Evidence baseline

Reviewed 2026-10-09 against OpenClaw 2026.9.1 (`ad6fe23`).

## Method

For every candidate capability:

1. Resolve the comparison product to a first-party source.
2. Translate marketing language into observable behavior.
3. Check current OpenClaw documentation for a first-class equivalent.
4. Classify the result as a true gap, partial/productized gap, or overlap.
5. Specify only true and useful partial gaps.

## First-party sources

### Hermes Agent

- <https://github.com/NousResearch/hermes-agent>
- <https://hermes-agent.nousresearch.com/docs/>
- <https://docs.openclaw.ai/start/why-openclaw/openclaw-and-hermes-agent>

### Grok Bot

- <https://docs.x.ai/grok-bot/overview>
- <https://docs.x.ai/grok-bot/computer-and-apps>
- <https://docs.x.ai/grok-bot/team-bots>
- <https://docs.x.ai/grok-bot/teams-and-enterprises>

### OpenAI Dots

- <https://openai.com/index/introducing-dots/>
- <https://openai.com/index/how-we-build-safety-security-and-privacy-into-dots/>

### OpenClaw baseline

- <https://docs.openclaw.ai/tools/skill-workshop/authoring>
- <https://docs.openclaw.ai/gateway/cloud-sessions>
- <https://docs.openclaw.ai/nodes/computer-use>
- <https://docs.openclaw.ai/concepts/main-session>
- <https://docs.openclaw.ai/concepts/parallel-specialist-lanes>

## Excluded overlaps

OpenClaw already has supported first-class versions of:

- Cross-channel personal-agent continuity
- Persistent memory and Honcho integration
- Cron, heartbeats, and durable TaskFlow work
- Subagents, parallel specialist lanes, and session handoffs
- Computer use, cloud-worker desktops, and human takeover
- Voice and mobile node surfaces
- Explicit `/learn` and autonomous repair of a skill used in the current run
- SecretRefs, structural tool policy, and deterministic approval gates

Those capabilities are not Sylar targets.

## Important partial-gap distinctions

- OpenClaw has cloud workers, but they are disposable by design; Grok Bot and Dots productize a durable managed personal computer.
- OpenClaw can record/replay computer trajectories and author skills, but it does not compile a demonstrated workflow into a reviewed skill and routine.
- OpenClaw agents can hand work across sessions, but it lacks a first-class persistent peer-agent group with explicit task ownership.
- OpenClaw can create or repair skills, but general post-task synthesis is not an automatic closed loop.
- OpenClaw has deterministic policy and approvals, but not a separate semantic reviewer evaluating proposed effects against natural-language standing rules.
