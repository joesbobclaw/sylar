import { spawn } from "node:child_process";
import { buildReviewerPrompt } from "../../spikes/001-semantic-action-review/src/reviewer-prompt.mjs";

// Only the fixed worker path is in OS argv; private prompt crosses stdin, never a
// shell, command argument, file, Gateway/session transcript, or application log.
export function createReviewer({ model = "openai/gpt-5.6-luna", timeoutMs = 30000,
  cliModule, nodeBinary = process.execPath, launch = spawn } = {}) {
  if (!cliModule) throw new Error("CLI module must be configured");
  if (model !== "openai/gpt-5.6-luna") throw new Error("Unapproved reviewer model");
  return (effect, { signal } = {}) => new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error("cancelled")); return; }
    const safeEnv = Object.fromEntries(["HOME", "USER", "LOGNAME", "PATH", "TMPDIR", "OPENCLAW_STATE_DIR", "OPENCLAW_CONFIG_PATH"].filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]]));
    const child = launch(nodeBinary, [new URL("./infer-worker.mjs", import.meta.url).pathname], {
      env: { ...safeEnv, NODE_DISABLE_COMPILE_CACHE: "1", OPENCLAW_LOG_LEVEL: "silent" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let output = "";
    let done = false;
    const finish = (error, value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      child.kill("SIGKILL");
      output = "";
      error ? reject(error) : resolve(value);
    };
    const abort = () => finish(new Error("cancelled"));
    const timer = setTimeout(() => finish(new Error("timeout")), timeoutMs);
    signal?.addEventListener("abort", abort, { once: true });
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      if (Buffer.byteLength(output) > 32768) finish(new Error("error"));
    });
    child.stderr.on("data", () => {}); // Never persist or relay provider/CLI error bodies.
    child.stdin.on("error", () => finish(new Error("error")));
    child.on("error", () => finish(new Error("error")));
    child.on("close", (code) => {
      if (done) return;
      if (code !== 0) { finish(new Error("error")); return; }
      try {
        const result = JSON.parse(output);
        // Worker emits only a strict decision; free-text explanation is not exported.
        if (!["allow", "approval_required", "human_only", "deny"].includes(result.outcome)) throw new Error();
        finish(null, { outcome: result.outcome });
      } catch { finish(new Error("error")); }
    });
    child.stdin.end(JSON.stringify({ model, cliModule, prompt: buildReviewerPrompt(effect) }));
  });
}
