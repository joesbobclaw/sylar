import { performance } from "node:perf_hooks";

// Completed hook timings ride on the next proposal: this includes awaited
// audit IO without a second write that would recursively need measuring.
// The last in-memory tail is deliberately lost on shutdown, never estimated.
export function createHookTiming({ now = () => performance.now(), maxSamples = 128 } = {}) {
  let samples = [];
  let dropped = 0;
  return {
    wrap(phase, hook) {
      return async (...args) => {
        const start = now();
        try { return await hook(...args); }
        finally {
          const durationMs = Math.max(0, now() - start);
          if (samples.length < maxSamples) samples.push({ phase, durationMs });
          else dropped++;
        }
      };
    },
    drain() {
      const result = { samples, dropped };
      samples = [];
      dropped = 0;
      return result;
    },
  };
}
