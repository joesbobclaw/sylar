# Restricted proactive research

## Status

Proposed · Priority P0 · Source: OpenAI Dots.

## Source behavior and gap

Dots runs background research over permitted connected sources using code-enforced read-only tools. The research task cannot send messages, mutate connected data, or control a browser or desktop; it writes private notes for the dot.

OpenClaw heartbeats and cron can proactively inspect sources, but their safety depends on the selected agent's ordinary tool policy. The missing primitive is a dedicated execution class whose read-only boundary is enforced by the broker. True enforcement gap; behavior is otherwise approximable.

## Outcome

An agent can notice useful changes—travel disruption, deadline drift, new issue activity, price movement, project blockers—without receiving ambient write authority.

## Proposed design

Create `research.run` as a restricted TaskFlow execution class:

- Explicit source allowlist and query budget
- Broker-issued read capability tokens
- No general browser, computer, shell, send, write, or secret-read tools
- Immutable source snapshots or source references
- Private `ResearchNote` output with claims, evidence links, freshness, confidence, and suggested follow-up
- Separate foreground decision decides whether to notify or act

The research model may recommend actions but cannot execute them. Follow-up enters the normal policy and review pipeline as a new task.

## Trust and safety

- Enforce method/effect type, not tool naming conventions.
- Connector metadata must distinguish reads that cause side effects, such as marking a message read.
- Notes inherit source sensitivity and retention policy.
- Prompt injection is treated as quoted source content.
- The lane receives no standing credentials except brokered read handles.
- Rate, cost, and source-volume budgets are mandatory.

## MVP

Read-only GitHub, RSS/HTTP JSON, and calendar snapshots. Run on a schedule, produce notes, and surface only high-confidence changes in an operator review queue.

## Acceptance tests

- Cannot invoke a connector write even if the model requests it indirectly.
- Cannot open an arbitrary URL outside the source allowlist.
- Does not mark email as read when read-only means no mailbox mutation.
- Retains citations sufficient to reproduce every surfaced claim.
- Deduplicates unchanged findings across runs.
- A malicious document cannot alter the lane's rules or enable tools.
- Follow-up action starts a separately authorized foreground task.

## Acquisition test

The capability is acquired when unattended research can discover and preserve useful changes while code—not prompting—makes external side effects impossible.
