# Trajectory lab

## Status

Proposed · Priority P1 · Source: Hermes Agent.

## Source behavior and gap

Hermes advertises batch trajectory generation and compression for training tool-calling models. OpenClaw stores transcripts, tool events, audit metadata, and experimental run artifacts but has no first-class pipeline for producing privacy-reviewed training/evaluation datasets. True research-tooling gap.

## Outcome

Researchers can generate, normalize, filter, compress, and export reproducible agent trajectories without scraping operational logs ad hoc.

## Proposed design

The lab operates on explicit study runs or consented operational records:

1. Define task suite, model, tools, policy, seeds, and budget.
2. Run isolated batches with immutable manifests.
3. Normalize turns, observations, decisions, calls, results, costs, and outcomes.
4. Remove secrets and classify sensitive data.
5. Compress only after retaining a lossless evidence bundle.
6. Score quality, policy compliance, and tool correctness.
7. Export versioned JSONL/Parquet with schema and dataset card.

Compression must preserve causal order, tool arguments necessary for learning, failures, and human interventions. It must not rewrite unsuccessful runs into clean success stories.

## Trust and safety

- Default-deny operational transcript inclusion.
- Consent and provenance attached per source.
- Secrets and restricted data removal verified before export.
- Train/test contamination checks and stable split keys.
- Sealed outcomes for preregistered experiments.
- No external upload without explicit authorization.

## MVP

Synthetic task suite, two models, fake tools, lossless normalized schema, deterministic compression, redaction tests, and local JSONL export.

## Acceptance tests

- Re-running a manifest produces the same task allocation and split.
- Compression retains all tool effects and failure branches.
- Secret canaries never appear in exported data.
- Dataset cards enumerate models, prompts, tools, policy, exclusions, and limits.
- Mixed-origin records retain per-record provenance.
- Failed and interrupted runs remain represented.

## Acquisition test

The capability is acquired when OpenClaw can produce a reproducible, provenance-rich, redaction-verified trajectory dataset from declared runs without manual transcript scraping.
