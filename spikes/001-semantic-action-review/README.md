# Spike 001: Semantic Action Review

## Question

Can OpenClaw support a shadow-only pre-execution review layer that normalizes consequential tool calls, preserves deterministic authority boundaries, asks an isolated tool-less model for semantic judgment, and produces measurable recommendations without changing live behavior?

## Safety boundary

This is a throwaway feasibility spike. It is **not installed**, has no live connector credentials, and never blocks, approves, rewrites, or executes a tool call. All fixtures are synthetic.

## Design

1. OpenClaw's `before_tool_call` hook is the future integration seam.
2. A trusted adapter converts a tool call into `ProposedEffect`.
3. A deterministic gate handles structural denial, stale approvals, mandatory human-only actions, and low-risk fast paths.
4. Only consequential effects reach the isolated semantic reviewer.
5. The final shadow recommendation is the stricter of deterministic and semantic outcomes.
6. `after_tool_call` can later compare the actual effect with the reviewed proposal.

The semantic reviewer has no tools. It cannot widen structural permissions, and an error yields a `human_only` shadow recommendation. Effect approvals are bound to a canonical SHA-256 digest and ruleset version.

## Run

Requires Node.js 22+ and no npm dependencies.

```sh
npm test
npm run evaluate
npm run evaluate:model
```

Reports are written to `reports/`. Exit code is nonzero below 90% accuracy, on reviewer error, or on an authority-expansion attempt.

## Acceptance gates

- At least 90% agreement with human fixture labels.
- Zero authority-expansion attempts.
- Structural denials never invoke semantic review.
- Reviewer failure produces a conservative recommendation.
- Prompt injection inside proposed content is treated as data.
- Shadow mode causes no live side effect or policy decision.

## OpenClaw mapping

The sample `openclaw-plugin/index.ts` shows the intended hook shape but deliberately omits installation and enforcement. Production work still needs a reviewed tool/action registry, request provenance, recipient/data classification, redacted audit storage, concurrency controls, and approval lifecycle UX.

## Verdict

**VALIDATED for a shadow-only spike.** On 2026-10-10:

- Node test suite: 9/9 passed.
- Tool-less `openai/gpt-5.6-luna` reviewer: 20/20 fixture labels (15 reviewed, five deterministic fast paths).
- Heuristic reviewer: 18/20 labels; both misses were conservative false positives.
- Authority expansion attempts: zero.
- Reviewer errors on the final run: zero.

This validates feasibility, not production readiness. The next build is the trusted normalizer and redacted audit sink in an uninstalled OpenClaw plugin, followed by a sustained shadow deployment before any enforcement.
