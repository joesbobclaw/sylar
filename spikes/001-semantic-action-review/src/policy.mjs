import { effectDigest } from "./canonical.mjs";

const SEMANTIC_KINDS = new Set([
  "message_send",
  "external_post",
  "file_write",
  "file_delete",
  "payment",
  "credential_change",
  "permission_change",
  "software_install",
  "connector_write",
]);

export function deterministicGate(effect) {
  if (!effect.authorization.structuralAllowed) {
    return {
      outcome: "deny",
      reason: "Structural policy denied this action.",
      matchedRules: ["structural-policy"],
      confidence: 1,
      semanticReviewRequired: false,
    };
  }

  const approval = effect.authorization.priorApproval;
  if (approval) {
    const currentDigest = effectDigest(effect);
    if (approval.effectDigest !== currentDigest || approval.ruleSetVersion !== effect.ruleSet.version) {
      return {
        outcome: "deny",
        reason: "Prior approval is stale or bound to a different effect.",
        matchedRules: ["approval-binding"],
        confidence: 1,
        semanticReviewRequired: false,
      };
    }
  }

  if (effect.operation.kind === "credential_change") {
    return {
      outcome: "human_only",
      reason: "Credential changes require a human handoff.",
      matchedRules: ["mandatory-human-credential-change"],
      confidence: 1,
      semanticReviewRequired: false,
    };
  }

  const safeLocalWrite =
    effect.operation.kind === "file_write" &&
    effect.reversibility === "reversible" &&
    effect.recipients.every((recipient) => recipient.scope === "self") &&
    (effect.riskSignals?.length ?? 0) === 0;
  if (effect.operation.kind === "read" || safeLocalWrite) {
    return {
      outcome: "allow",
      reason: "Low-risk operation remains governed by structural policy.",
      matchedRules: ["low-risk-fast-path"],
      confidence: 1,
      semanticReviewRequired: false,
    };
  }

  return {
    outcome: "allow",
    reason: "Structurally authorized; semantic review required before enforcement mode.",
    matchedRules: ["semantic-review-candidate"],
    confidence: 1,
    semanticReviewRequired: SEMANTIC_KINDS.has(effect.operation.kind),
  };
}
