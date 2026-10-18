import { EphemeralReviewEnvelopeStore } from "../../plugins/semantic-action-review/src/ephemeral-review-envelope.js";
import { validateEffect, DECISION_SEVERITY } from "../../spikes/001-semantic-action-review/src/contracts.mjs";
import { deterministicGate } from "../../spikes/001-semantic-action-review/src/policy.mjs";
import { buildLabelReport } from "../../plugins/semantic-action-review/src/label-report.js";

export const CATEGORY_KINDS = {
  message: ["message_send"], file_mutation: ["file_write", "file_delete"],
  publication: ["external_post"], connector_write: ["connector_write"],
  credential_permission: ["credential_change", "permission_change"],
};
export const CATEGORIES = Object.keys(CATEGORY_KINDS);
export class PilotService {
  constructor({ reviewer, now = Date.now, ttlMs = 5 * 60 * 1000, persist = async () => {}, allowProspective = false } = {}) {
    this.reviewer = reviewer;
    this.now = now;
    this.persist = persist;
    this.allowProspective = allowProspective;
    this.ttlMs = ttlMs;
    this.store = new EphemeralReviewEnvelopeStore({ maxConcurrent: 1, ttlMs, now });
    this.active = null;
    this.rows = [];
    this.sequence = 0;
    this.prospectiveAdmissions = 0;
    this.counts = { admitted: 0, expired: 0, cancelled: 0, rejected: 0, labelled: 0, reviewerFailures: 0, persistenceFailures: 0 };
  }
  sweep() {
    if (this.active && this.now() >= this.active.expiresAt) this.remove("expired");
  }
  async admit({ category, source, effect } = {}) {
    this.sweep();
    if (!CATEGORIES.includes(category) || !["synthetic", "prospective"].includes(source) ||
        (source === "prospective" && (!this.allowProspective || this.prospectiveAdmissions >= 12)) || this.active || this.sequence >= 9999) {
      this.counts.rejected++;
      throw new Error("admission_rejected");
    }
    try { validateEffect(effect); } catch { this.counts.rejected++; throw new Error("admission_rejected"); }
    if (!CATEGORY_KINDS[category].includes(effect.operation.kind)) { this.counts.rejected++; throw new Error("admission_rejected"); }
    const sampleId = `sample-${String(++this.sequence).padStart(4, "0")}`;
    let expiresAt;
    try { ({ expiresAt } = this.store.admit({ eventId: sampleId, action: effect })); }
    catch { this.counts.rejected++; throw new Error("admission_rejected"); }
    const controller = new AbortController();
    const state = { sampleId, category, source, expiresAt, controller, ready: false, sealed: null };
    this.active = state;
    this.counts.admitted++;
    if (source === "prospective") this.prospectiveAdmissions++;
    state.timer = setTimeout(() => this.removeIfCurrent(state, "expired"), this.ttlMs);
    state.timer.unref?.();
    // The store owns the only retained action; reviewer receives a short-lived clone.
    let action = this.store.beginReview(sampleId).action;
    const floor = deterministicGate(action).outcome;
    try {
      const decision = await this.reviewer(action, { signal: controller.signal });
      if (!Object.hasOwn(DECISION_SEVERITY, decision.outcome)) throw new Error("error");
      state.sealed = { decision: DECISION_SEVERITY[floor] > DECISION_SEVERITY[decision.outcome] ? floor : decision.outcome, status: "ok" };
    } catch (error) {
      state.sealed = { decision: floor === "deny" ? "deny" : "human_only", status: error?.message === "timeout" ? "timeout" : controller.signal.aborted ? "cancelled" : "error" };
      this.counts.reviewerFailures++;
    } finally { action = null; }
    this.sweep();
    if (this.active !== state) return { admitted: true, available: false };
    state.ready = true;
    return { admitted: true, available: true };
  }
  current() {
    this.sweep();
    const state = this.active;
    if (!state) return null;
    // No model decision/status/rationale leaks before independent human commitment.
    return { sampleId: state.sampleId, category: state.category, source: state.source,
      remainingMs: Math.max(0, state.expiresAt - this.now()), ready: state.ready,
      effect: structuredClone(this.store.entries.get(state.sampleId)?.payload) };
  }
  async label({ sampleId, decision, humanIndependent } = {}) {
    this.sweep();
    const state = this.active;
    if (!state || !state.ready || state.sampleId !== sampleId ||
        !Object.hasOwn(DECISION_SEVERITY, decision) || typeof humanIndependent !== "boolean") throw new Error("label_rejected");
    const row = { sampleId, source: state.source, category: state.category,
      reviewerDecision: state.sealed.decision, humanDecision: decision,
      humanIndependent, reviewerStatus: state.sealed.status };
    buildLabelReport([row]);
    // Commit human judgement once, then delete raw data before writing metadata.
    this.store.finishReview(sampleId, { decision: row.reviewerDecision, reviewerStatus: row.reviewerStatus });
    clearTimeout(state.timer);
    this.active = null;
    state.controller.abort();
    state.sealed = null;
    this.rows.push(row);
    this.counts.labelled++;
    try { await this.persist(row); }
    catch { this.counts.persistenceFailures++; }
    return { humanDecision: decision, reviewerDecision: row.reviewerDecision,
      reviewerStatus: row.reviewerStatus, agrees: row.reviewerDecision === decision,
      recorded: this.counts.persistenceFailures === 0, source: row.source };
  }
  removeIfCurrent(state, reason) { if (this.active === state) this.remove(reason); }
  remove(reason = "cancelled") {
    if (!this.active) return false;
    const state = this.active;
    this.active = null;
    clearTimeout(state.timer);
    state.controller.abort();
    this.store.cancel(state.sampleId);
    state.sealed = null;
    this.counts[reason]++;
    return true;
  }
  report() { this.sweep(); return { ...buildLabelReport(this.rows), attrition: { ...this.counts }, prospectiveAdmissions: this.prospectiveAdmissions, prospectiveLimit: 12, active: Boolean(this.active) }; }
  shutdown() { this.remove(); this.store.shutdown(); }
}
