# Post-task learning loop

## Status

Proposed · Priority P0 · Source: Hermes Agent.

## Source behavior and gap

Hermes advertises autonomous skill creation after complex tasks and skills that improve during use. OpenClaw provides explicit `/learn` and can automatically repair a skill that proved wrong or incomplete in the current run. The gap is general, evidence-driven synthesis after work finishes, including when no existing skill was invoked. Partial gap.

## Outcome

Repeated successful work, corrections, and recoveries become proposed reusable procedures without depending on the user to remember `/learn`.

## Proposed design

At task close, a cheap classifier evaluates whether the trajectory contains durable learning. Positive cases create a `LearningCandidate` with:

- problem pattern and triggering context
- reusable procedure or correction
- supporting trajectory spans and outcomes
- expected applicability and exclusions
- candidate target: memory, existing skill, new skill, tool description, or no-op
- privacy and contamination labels

A synthesis worker deduplicates against live skills and pending proposals. It may stage a Skill Workshop proposal or memory suggestion under configured autonomy, but must not silently publish new broad authority.

## Trust and safety

- Learn from verified outcomes, not model confidence alone.
- Never learn credentials, private identifiers, transient errors, or unresolved guesses.
- Separate user preference learning from global procedural learning.
- Require multiple examples or a strong correction signal for broad rules.
- Preserve provenance and allow source deletion to invalidate derived candidates.
- Evaluation fixtures must include counterexamples to prevent overgeneralization.

## MVP

Analyze completed tasks in one workspace. Produce pending proposals only for repeated recoveries or explicit user corrections. No automatic publication of new skills.

## Acceptance tests

- Does not create a skill from a one-off transient outage.
- Merges a repeated fix into an existing skill instead of duplicating it.
- Preserves an explicit user correction and links the source turn.
- Rejects candidates containing secrets or personal data.
- Counterexample evaluation catches an overbroad rule.
- Source deletion marks dependent learning stale.

## Acquisition test

The ability is acquired when completed work automatically yields deduplicated, evidence-backed learning candidates that improve future behavior without silently converting accidents into policy.
