import { effectDigest } from "./canonical.mjs";
import { stricterDecision, validateDecision, validateEffect } from "./contracts.mjs";
import { deterministicGate } from "./policy.mjs";

export async function shadowReview(effect, reviewer) {
  validateEffect(effect);
  const deterministic = deterministicGate(effect);
  const base = {
    effectId: effect.id,
    effectDigest: effectDigest(effect),
    ruleSetVersion: effect.ruleSet.version,
    deterministic,
    mode: "shadow",
    enforced: false,
  };

  if (!deterministic.semanticReviewRequired) {
    return {
      ...base,
      semantic: null,
      shadowOutcome: deterministic.outcome,
      authorityExpansionAttempt: false,
      reviewerStatus: "skipped",
    };
  }

  try {
    const semantic = validateDecision(await reviewer(effect));
    return {
      ...base,
      semantic,
      shadowOutcome: stricterDecision(deterministic.outcome, semantic.outcome),
      authorityExpansionAttempt:
        deterministic.outcome === "deny" && semantic.outcome !== "deny",
      reviewerStatus: "ok",
    };
  } catch (error) {
    return {
      ...base,
      semantic: null,
      shadowOutcome: "human_only",
      authorityExpansionAttempt: false,
      reviewerStatus: "error",
      reviewerError: String(error?.message ?? error).slice(0, 300),
    };
  }
}
