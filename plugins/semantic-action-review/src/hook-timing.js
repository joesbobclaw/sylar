import { performance } from "node:perf_hooks";

// Fixed-size, non-cumulative bins. Last bin holds values above the final bound.
// Completed hook timings ride on the next proposal; no recursive audit write.
// A process's unpersisted final tail is still lost and must never be estimated.
export const TIMING_BOUNDS_MS = Object.freeze([
  0.125, 0.25, 0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 25, 32,
  40, 50, 64, 80, 100, 128, 160, 200, 256, 320, 500, 750, 1000, 2000, 5000, 10000,
]);
export const timingBin = (durationMs) => {
  const index = TIMING_BOUNDS_MS.findIndex((bound) => durationMs <= bound);
  return index < 0 ? TIMING_BOUNDS_MS.length : index;
};
export const emptyTimingHistogram = (phase) => ({
  phase, counts: Array(TIMING_BOUNDS_MS.length + 1).fill(0), maxMs: null,
});

export function createHookTiming({ now = () => performance.now() } = {}) {
  let histograms = [emptyTimingHistogram("before"), emptyTimingHistogram("after")];
  let invalid = 0;
  return {
    wrap(phase, hook) {
      if (!["before", "after"].includes(phase)) throw new TypeError("invalid timing phase");
      return async (...args) => {
        const start = now();
        try { return await hook(...args); }
        finally {
          const durationMs = now() - start;
          if (!Number.isFinite(durationMs) || durationMs < 0) invalid++;
          else {
            const histogram = histograms[phase === "before" ? 0 : 1];
            histogram.counts[timingBin(durationMs)]++;
            histogram.maxMs = Math.max(histogram.maxMs ?? 0, durationMs);
          }
        }
      };
    },
    drain() {
      const result = { timingVersion: 2, histograms, dropped: 0, invalid };
      histograms = [emptyTimingHistogram("before"), emptyTimingHistogram("after")];
      invalid = 0;
      return result;
    },
  };
}
