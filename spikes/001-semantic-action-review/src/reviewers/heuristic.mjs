import { validateDecision } from "../contracts.mjs";

function hasRule(effect, id) {
  return effect.ruleSet.rules.some((rule) => rule.id === id);
}

export async function heuristicReviewer(effect) {
  let outcome = "allow";
  let reason = "The action is bounded and consistent with the supplied authorization.";
  const matchedRules = [];

  if (!effect.authorization.structuralAllowed) {
    outcome = "deny";
    reason = "Structural authority is absent.";
    matchedRules.push("structural-policy");
  } else if (effect.riskSignals?.includes("recipient_mismatch")) {
    outcome = "deny";
    reason = "The proposed recipient differs from the authorized recipient.";
    matchedRules.push("recipient-binding");
  } else if (effect.riskSignals?.includes("private_data_public")) {
    outcome = "deny";
    reason = "Private data would be disclosed to a public or unauthorized audience.";
    matchedRules.push("data-boundary");
  } else if (effect.riskSignals?.includes("instruction_conflict")) {
    outcome = "deny";
    reason = "The action conflicts with the user's instruction or standing rules.";
    matchedRules.push("instruction-scope");
  } else if (effect.riskSignals?.includes("unrecognized_software")) {
    outcome = "deny";
    reason = "The action would install or run software from an unrecognized source.";
    matchedRules.push("software-source");
  } else if (effect.operation.kind === "credential_change") {
    outcome = "human_only";
    reason = "Credential changes must be completed directly by the human.";
    matchedRules.push("mandatory-human-credential-change");
  } else if (effect.operation.kind === "permission_change" && effect.riskSignals?.includes("admin_grant")) {
    outcome = "human_only";
    reason = "Granting administrative access requires a human handoff.";
    matchedRules.push("privilege-escalation");
  } else if (effect.operation.kind === "payment" && Number(effect.operation.parameters?.amount ?? 0) >= 1000) {
    outcome = "human_only";
    reason = "High-value financial transfer requires direct human completion.";
    matchedRules.push("high-value-payment");
  } else if (
    ["payment", "external_post", "software_install"].includes(effect.operation.kind) ||
    effect.reversibility === "irreversible" ||
    effect.riskSignals?.includes("sensitive_data") ||
    hasRule(effect, "confirm-external-send")
  ) {
    outcome = "approval_required";
    reason = "The exact consequential action requires confirmation before execution.";
    matchedRules.push("confirm-consequential-action");
  }

  return validateDecision({ outcome, reason, matchedRules, confidence: 0.9 });
}
