# Persistent agent collaboration

## Status

Proposed · Priority P0 · Source: Grok Bot.

## Source behavior and gap

Grok Bots can run in parallel, message each other, share a group conversation, and transfer task ownership. OpenClaw supports subagents, session messaging, background completion, and specialist lanes, but coordination remains largely parent/child or prompt-convention driven. The missing product primitive is a durable peer team with explicit ownership and recovery. Partial architectural gap.

## Outcome

Named agents can jointly own a project without forcing the human—or one coordinator prompt—to relay every update.

## Proposed design

Introduce a Gateway-owned task ledger:

- Tasks have objective, current owner, watchers, state, dependencies, lease, artifacts, authority ceiling, and append-only events.
- Agent teams have membership, purpose, routing policy, shared references, and a group timeline.
- Messages inform; ledger transitions control.
- Handoff is an atomic compare-and-swap from current owner to accepted new owner.
- Delegation carries a bounded capability envelope and data labels.
- Recovery reconciles leases and resumes from recorded checkpoints after restart.

Agents may negotiate ownership in chat, but only the ledger can change it. A task can have one accountable owner and multiple contributors.

## Trust and safety

- No privilege union: the recipient receives the intersection of task authority and its own ceiling.
- Private session content is not copied into team context by default.
- Artifacts use explicit references and labels, not transcript dumping.
- Handoffs preserve source attribution and user instructions.
- Side-effect idempotency survives owner changes.
- Loop and bounce detection stops pathological delegation.

## MVP

Three persistent agents, one team timeline, tasks with one owner, atomic handoff, dependencies, status updates, and restart recovery. No autonomous team creation.

## Acceptance tests

- Two agents cannot simultaneously acquire the same ownership lease.
- Restart during handoff yields exactly one owner.
- A lower-privilege recipient cannot inherit broader tool access.
- A task result routes to the correct team and initiating user.
- Duplicate or circular delegation is detected and stopped.
- Private source-session content stays private unless explicitly attached.

## Acquisition test

The capability is acquired when persistent peer agents coordinate through a durable task ledger, transfer ownership atomically, and recover without duplicated work or authority expansion.
