import { createHash } from "node:crypto";

const SENSITIVE_KEY = /(authorization|cookie|credential|password|passwd|secret|token|api[-_]?key|private[-_]?key|body|content|prompt|command|script|patch|query|message|text|url|path|file)/i;

function valueShape(value, depth = 0) {
  if (value === null) return { type: "null" };
  if (Array.isArray(value)) {
    return { type: "array", length: value.length, itemTypes: [...new Set(value.slice(0, 20).map((item) => valueShape(item, depth + 1).type))].sort() };
  }
  if (typeof value === "string") return { type: "string", length: value.length };
  if (typeof value === "number") return { type: "number", finite: Number.isFinite(value) };
  if (typeof value === "boolean") return { type: "boolean" };
  if (typeof value === "object") {
    if (depth >= 3) return { type: "object", truncated: true };
    const keys = Object.keys(value);
    return { type: "object", keyCount: keys.length, truncated: keys.length > 50 };
  }
  return { type: typeof value };
}

export function parameterShape(params) {
  const entries = Object.entries(params ?? {}).sort(([left], [right]) => left.localeCompare(right));
  return {
    keyCount: entries.length,
    fields: entries.slice(0, 100).map(([key, value], position) => ({
      position,
      sensitiveName: SENSITIVE_KEY.test(key),
      ...valueShape(value),
    })),
    truncated: entries.length > 100,
  };
}

export function resultShape(result) {
  return valueShape(result);
}

export function opaqueFingerprint(value, processSalt) {
  return createHash("sha256").update(processSalt).update("\0").update(String(value ?? "")).digest("hex").slice(0, 24);
}

export function containsRawValue(record, params) {
  const serialized = JSON.stringify(record);
  const candidates = [];
  function collect(value) {
    if (typeof value === "string" && value.length >= 8) candidates.push(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === "object") {
      for (const [key, item] of Object.entries(value)) {
        if (key.length >= 8) candidates.push(key);
        collect(item);
      }
    }
  }
  collect(params);
  return candidates.some((candidate) => serialized.includes(candidate));
}
