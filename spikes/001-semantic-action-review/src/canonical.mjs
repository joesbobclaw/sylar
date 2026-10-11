import { createHash } from "node:crypto";

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, normalize(nested)]),
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(normalize(value));
}

export function effectDigest(effect) {
  const bound = {
    actor: effect.actor,
    request: effect.request,
    operation: effect.operation,
    recipients: effect.recipients,
    dataClasses: effect.dataClasses,
    reversibility: effect.reversibility,
    authorization: {
      structuralAllowed: effect.authorization.structuralAllowed,
      userAuthorization: effect.authorization.userAuthorization ?? null,
    },
    expectedResult: effect.expectedResult,
    ruleSetVersion: effect.ruleSet.version,
    idempotencyKey: effect.idempotencyKey,
  };
  return createHash("sha256").update(canonicalJson(bound)).digest("hex");
}
