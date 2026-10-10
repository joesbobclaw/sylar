# Demonstration-to-skill compiler

## Status

Proposed · Priority P0 · Source: Grok Bot.

## Source behavior and gap

Grok Bot says a user can walk a bot through a multi-step workflow, save the path as a skill, and rerun it on a schedule. OpenClaw can record/replay computer trajectories and can create skills through Skill Workshop, but it lacks the reviewed compilation pipeline joining them. Partial/productized gap.

## Outcome

A user performs a workflow once—possibly across browser, desktop, files, and connectors—and receives a parameterized, testable skill rather than a brittle click macro.

## Proposed design

1. **Record:** capture observations, semantic elements, tool calls, user interventions, inputs, outputs, and checkpoints.
2. **Segment:** infer logical steps and distinguish constants, secrets, examples, and parameters.
3. **Lift:** prefer stable APIs/connectors and accessibility selectors over coordinates.
4. **Synthesize:** create a complete Skill Workshop proposal plus fixtures and declared tool requirements.
5. **Replay:** execute against a sandbox or mock service with fresh data.
6. **Review:** show the user steps, variables, permissions, failure paths, and schedule semantics.
7. **Publish:** apply through existing Skill Workshop policy.

The compiler should produce a procedure, not executable hidden state. Raw trajectories remain evidence and debugging material.

## Trust and safety

- Redact secrets and sensitive values before model synthesis.
- Never embed cookies, tokens, local paths, or one-time codes in a skill.
- Detect destructive steps and require explicit semantics.
- A demonstration grants no future authority; the generated skill declares requirements and normal policy evaluates every run.
- Scheduled runs fail closed at human-only steps.

## MVP

Support one browser workflow with three to ten steps, accessible element references, two inferred parameters, one approval boundary, and a replay test against a fixture site.

## Acceptance tests

- Replays after page layout changes that preserve semantic elements.
- Correctly parameterizes date, account, and recipient rather than memorizing examples.
- Refuses to store demonstrated credentials.
- Detects a CAPTCHA/2FA handoff instead of attempting bypass.
- Produces a readable skill and an evidence-linked proposal.
- Fails clearly when only coordinate-level replay is possible.

## Acquisition test

The ability is acquired when a user demonstration becomes a reviewed, parameterized OpenClaw skill that succeeds on fresh inputs without retaining secret or coordinate-only state.
