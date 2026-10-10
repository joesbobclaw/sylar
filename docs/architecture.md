# Reference architecture

Sylar should be implemented as small OpenClaw-native primitives, not as a parallel agent runtime.

## Layers

### 1. Evidence layer

Immutable records of proposed actions, tool effects, task transitions, demonstrations, feedback, and learning candidates. Every higher layer consumes attributable records rather than raw prose alone.

### 2. Policy layer

Deterministic authorization remains authoritative. Semantic review can narrow authority or request approval; it can never enlarge structural permissions.

Order of evaluation:

1. Identity and role ceiling
2. Tool and resource policy
3. Deterministic effect classification
4. Standing rules
5. Semantic review
6. Human approval when required
7. Execution with an idempotency key
8. Post-effect verification and audit

### 3. Task and coordination layer

A durable task ledger owns state, assignee, dependencies, leases, evidence, and handoffs. Chat messages may discuss a task, but they do not constitute task ownership.

### 4. Learning layer

Demonstrations, successful trajectories, corrections, and repeated work become candidates. Candidates must be deduplicated, evaluated, and reviewed before promotion into live skills or standing memory.

### 5. Execution layer

Existing OpenClaw Gateway, nodes, sandboxes, cloud workers, computer use, Code Mode, connectors, and plugins perform work. Sylar should extend these surfaces rather than bypass them.

### 6. Presentation layer

Control UI surfaces show activity, rules, reviews, task ownership, learning candidates, provenance, and rollback. Chat remains an interface, not the source of truth.

## Shared contracts

Every acquired ability should reuse these objects:

- `ActorRef`: human, agent, service, or reviewer identity
- `ResourceRef`: target account, file, conversation, computer, or connector
- `ProposedEffect`: normalized action, arguments, recipients, data classes, reversibility, and expected result
- `PolicyDecision`: allow, deny, require approval, or handoff, with reasons and matched rules
- `TaskRecord`: objective, owner, state, dependencies, artifacts, and evidence
- `TrajectoryRecord`: ordered observations, decisions, calls, effects, feedback, and provenance
- `LearningCandidate`: proposed reusable knowledge plus evidence and evaluation status

## Non-negotiable invariants

- Semantic systems never create authority.
- Read-only modes are enforced at the tool broker, not by prompting.
- Credentials never enter model-visible context when a brokered flow exists.
- Retries of side effects are idempotent or require renewed review.
- Agent-to-agent handoffs preserve the original authority ceiling and data restrictions.
- Learned behavior is versioned, attributable, testable, and reversible.
- Every UI summary links to underlying evidence.
