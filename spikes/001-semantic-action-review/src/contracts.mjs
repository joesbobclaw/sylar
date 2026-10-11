export const DECISIONS = Object.freeze([
  "allow",
  "approval_required",
  "human_only",
  "deny",
]);

export const DECISION_SEVERITY = Object.freeze({
  allow: 0,
  approval_required: 1,
  human_only: 2,
  deny: 3,
});

const EFFECT_KINDS = new Set([
  "read",
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

export function validateEffect(effect) {
  const errors = [];
  if (!effect || typeof effect !== "object") errors.push("effect must be an object");
  if (effect?.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (typeof effect?.id !== "string" || !effect.id) errors.push("id is required");
  if (typeof effect?.actor?.id !== "string") errors.push("actor.id is required");
  if (!['human', 'agent', 'automation'].includes(effect?.actor?.type)) errors.push("actor.type is invalid");
  if (typeof effect?.request?.source !== "string") errors.push("request.source is required");
  if (typeof effect?.request?.instruction !== "string") errors.push("request.instruction is required");
  if (!EFFECT_KINDS.has(effect?.operation?.kind)) errors.push("operation.kind is invalid");
  if (typeof effect?.operation?.tool !== "string") errors.push("operation.tool is required");
  if (typeof effect?.operation?.action !== "string") errors.push("operation.action is required");
  if (typeof effect?.operation?.target !== "string") errors.push("operation.target is required");
  if (typeof effect?.authorization?.structuralAllowed !== "boolean") {
    errors.push("authorization.structuralAllowed must be boolean");
  }
  if (!Array.isArray(effect?.dataClasses)) errors.push("dataClasses must be an array");
  if (!Array.isArray(effect?.recipients)) errors.push("recipients must be an array");
  if (!['reversible', 'partially_reversible', 'irreversible'].includes(effect?.reversibility)) {
    errors.push("reversibility is invalid");
  }
  if (typeof effect?.expectedResult !== "string") errors.push("expectedResult is required");
  if (typeof effect?.ruleSet?.version !== "string") errors.push("ruleSet.version is required");
  if (!Array.isArray(effect?.ruleSet?.rules)) errors.push("ruleSet.rules must be an array");
  if (effect?.riskSignals !== undefined && !Array.isArray(effect.riskSignals)) {
    errors.push("riskSignals must be an array when provided");
  }
  if (typeof effect?.idempotencyKey !== "string") errors.push("idempotencyKey is required");
  if (errors.length) throw new TypeError(errors.join("; "));
  return effect;
}

export function validateDecision(decision) {
  const errors = [];
  if (!decision || typeof decision !== "object") errors.push("decision must be an object");
  if (!DECISIONS.includes(decision?.outcome)) errors.push("outcome is invalid");
  if (typeof decision?.reason !== "string" || !decision.reason) errors.push("reason is required");
  if (!Array.isArray(decision?.matchedRules)) errors.push("matchedRules must be an array");
  if (typeof decision?.confidence !== "number" || decision.confidence < 0 || decision.confidence > 1) {
    errors.push("confidence must be between 0 and 1");
  }
  if (errors.length) throw new TypeError(errors.join("; "));
  return decision;
}

export function stricterDecision(left, right) {
  return DECISION_SEVERITY[left] >= DECISION_SEVERITY[right] ? left : right;
}
