# Semantic action review

## Status

Proposed · Priority P0 · Source: OpenAI Dots, with a related Grok Bot Auto Review pattern.

## Source behavior and gap

Dots describes a separate system that reviews planned consequential actions against instructions, Custom Rules, and mandatory safety requirements before execution. It can allow, block, request approval, or force a human handoff.

OpenClaw already has structural tool policy, role ceilings, deterministic command classification, and approvals. The missing behavior is a general semantic preflight over the *meaning and likely effect* of an otherwise authorized action. This is a true gap, but the reviewer must remain subordinate to deterministic policy.

## Outcome

An agent can prepare an email, file mutation, account change, purchase, publication, or cross-user disclosure and receive an independent, explainable decision before the side effect occurs.

## Non-goals

- Granting permissions that structural policy denied
- Replacing mandatory approvals
- Reviewing ordinary reads unless policy marks them sensitive
- Letting the acting model review its own proposal without separation

## Proposed design

Add a Gateway `effect.review` stage. Mutating tools normalize calls into a `ProposedEffect` containing actor, target, recipients, data classes, reversibility, authorization evidence, expected result, and idempotency key.

The pipeline is:

1. Structural policy evaluates identity, role, tool, and resource.
2. Deterministic classifiers attach risk and mandatory rules.
3. A separate review model receives bounded intent, standing rules, and the normalized effect—not ambient credentials or arbitrary workspace context.
4. The reviewer returns `allow`, `deny`, `approval_required`, or `human_only`, with cited rules and confidence.
5. The broker enforces the stricter of deterministic and semantic decisions.
6. Execution results are compared with the expected effect and logged.

Standing rules should be typed records with natural-language explanations, scope, owner, priority, expiry, and version. Natural language helps author them; a normalized policy form is what enforcement consumes.

## Trust and safety

- Reviewer cannot call tools.
- Untrusted target content is quoted and labeled, never injected as instructions.
- A reviewer timeout fails closed for high-risk effects and falls back to deterministic policy for explicitly low-risk classes.
- An approval binds to the exact effect digest, recipient set, data classes, and expiry.
- Changed arguments invalidate prior approval.
- Reviewer output and matched rules are preserved in audit records.

## MVP

Shadow-review synthetic and real-but-not-executed email sends, file deletes, public posts, connector writes, and credential/permission changes. Compare reviewer decisions with human labels; do not block live actions yet.

## Acceptance tests

- Blocks a message whose recipient differs from the user's instruction.
- Requires approval when sensitive data is added after an earlier approval.
- Cannot override a structural deny.
- Ignores prompt injection embedded in an email body or webpage.
- Produces stable decisions for semantically equivalent effects.
- Rejects replay after the effect digest or rule version changes.
- Survives reviewer outage without silently allowing high-risk work.

## Rollout

Shadow metrics → opt-in escalation only → opt-in blocking → default for selected effect classes. Every stage needs a one-switch bypass back to deterministic policy without deleting audit evidence.

## Acquisition test

OpenClaw has acquired this ability when a separate, tool-less reviewer reliably evaluates normalized effects against durable rules and can only narrow—not expand—the actor's authority.
