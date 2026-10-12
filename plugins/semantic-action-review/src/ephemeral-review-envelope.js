import { serialize } from "node:v8";

const DECISIONS = new Set(["allow", "deny", "approval_required", "human_only"]);
const REVIEW_STATUSES = new Set(["ok", "timeout", "cancelled", "error"]);

function fail(code) {
  const error = new Error(`ephemeral review envelope rejected: ${code}`);
  error.code = code;
  return error;
}

function latencyBucket(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs < 0) return "unknown";
  if (durationMs < 100) return "lt_100ms";
  if (durationMs < 500) return "100_499ms";
  if (durationMs < 2_000) return "500_1999ms";
  return "gte_2000ms";
}

/**
 * Memory-only holding area for raw action data needed by an isolated semantic
 * reviewer. This component deliberately has no filesystem or audit-sink
 * dependency and is not connected to the live hooks.
 */
export class EphemeralReviewEnvelopeStore {
  constructor({
    maxConcurrent = 100,
    maxEnvelopeBytes = 256 * 1024,
    maxTotalBytes = 8 * 1024 * 1024,
    ttlMs = 5 * 60 * 1_000,
    now = () => Date.now(),
    schedule = (callback, delay) => setTimeout(callback, delay),
    unschedule = (timer) => clearTimeout(timer),
  } = {}) {
    if (![maxConcurrent, maxEnvelopeBytes, maxTotalBytes, ttlMs].every((value) => Number.isInteger(value) && value > 0)) {
      throw fail("invalid_bounds");
    }
    this.bounds = { maxConcurrent, maxEnvelopeBytes, maxTotalBytes, ttlMs };
    this.now = now;
    this.schedule = schedule;
    this.unschedule = unschedule;
    this.entries = new Map();
    this.totalBytes = 0;
    this.activeReview = null;
    this.closed = false;
  }

  admit({ eventId, action }) {
    if (this.closed) throw fail("store_closed");
    this.sweepExpired();
    if (typeof eventId !== "string" || eventId.length === 0 || eventId.length > 256) throw fail("invalid_event_id");
    if (this.entries.has(eventId)) throw fail("duplicate_event");
    if (this.entries.size >= this.bounds.maxConcurrent) throw fail("concurrent_limit");

    let bytes;
    let payload;
    try {
      bytes = serialize(action).byteLength;
      payload = structuredClone(action);
    } catch {
      throw fail("uncloneable_action");
    }
    if (bytes > this.bounds.maxEnvelopeBytes) throw fail("envelope_size_limit");
    if (this.totalBytes + bytes > this.bounds.maxTotalBytes) throw fail("total_size_limit");

    const admittedAt = this.now();
    const expiresAt = admittedAt + this.bounds.ttlMs;
    const timer = this.schedule(() => this.expire(eventId), this.bounds.ttlMs);
    timer?.unref?.();
    this.entries.set(eventId, { eventId, payload, bytes, admittedAt, expiresAt, timer });
    this.totalBytes += bytes;
    return { admitted: true, eventId, expiresAt };
  }

  beginReview(eventId) {
    if (this.closed) throw fail("store_closed");
    this.sweepExpired();
    if (this.activeReview !== null) throw fail("reviewer_busy");
    const entry = this.entries.get(eventId);
    if (!entry) throw fail("envelope_unavailable");
    this.activeReview = eventId;
    return { eventId, action: structuredClone(entry.payload), expiresAt: entry.expiresAt };
  }

  finishReview(eventId, { decision, reviewerStatus = "ok", latencyMs, rationale = "" } = {}) {
    if (this.activeReview !== eventId) throw fail("review_not_active");
    if (!DECISIONS.has(decision)) throw fail("invalid_decision");
    if (!REVIEW_STATUSES.has(reviewerStatus)) throw fail("invalid_reviewer_status");
    if (typeof rationale !== "string" || rationale.length > 512) throw fail("invalid_rationale");
    this.remove(eventId);
    return {
      schemaVersion: 1,
      recordType: "semantic_review",
      eventId,
      label: decision,
      reviewerStatus,
      latencyBucket: latencyBucket(latencyMs),
    };
  }

  cancel(eventId) {
    return this.remove(eventId);
  }

  expire(eventId) {
    const entry = this.entries.get(eventId);
    if (!entry || entry.expiresAt > this.now()) return false;
    return this.remove(eventId);
  }

  sweepExpired() {
    const current = this.now();
    for (const [eventId, entry] of this.entries) {
      if (entry.expiresAt <= current) this.remove(eventId);
    }
  }

  remove(eventId) {
    const entry = this.entries.get(eventId);
    if (!entry) return false;
    this.unschedule(entry.timer);
    this.entries.delete(eventId);
    this.totalBytes -= entry.bytes;
    entry.payload = undefined;
    if (this.activeReview === eventId) this.activeReview = null;
    return true;
  }

  shutdown() {
    for (const eventId of [...this.entries.keys()]) this.remove(eventId);
    this.closed = true;
  }

  stats() {
    this.sweepExpired();
    return { count: this.entries.size, totalBytes: this.totalBytes, reviewerBusy: this.activeReview !== null };
  }
}

