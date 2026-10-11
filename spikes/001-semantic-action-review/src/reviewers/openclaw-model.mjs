import { spawn } from "node:child_process";
import { buildReviewerPrompt } from "../reviewer-prompt.mjs";
import { validateDecision } from "../contracts.mjs";

function extractJson(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("reviewer returned no JSON object");
    return JSON.parse(match[0]);
  }
}

export function createOpenClawModelReviewer({
  model = "openai/gpt-5.6-luna",
  timeoutMs = 120_000,
} = {}) {
  return async function review(effect) {
    const prompt = buildReviewerPrompt(effect);
    const args = [
      "infer",
      "model",
      "run",
      "--gateway",
      "--json",
      "--model",
      model,
      "--prompt",
      prompt,
    ];

    return await new Promise((resolve, reject) => {
      const child = spawn("openclaw", args, { stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`reviewer timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(`reviewer process failed (${code}): ${stderr.slice(0, 300)}`));
          return;
        }
        try {
          const envelope = JSON.parse(stdout);
          const candidate = envelope.outputs?.[0]?.text ?? envelope.outputText ?? envelope.text ?? envelope.output ?? envelope.result?.text;
          if (typeof candidate !== "string") throw new Error("unknown inference JSON envelope");
          resolve(validateDecision(extractJson(candidate)));
        } catch (error) {
          reject(new Error(`invalid reviewer response: ${error.message}`));
        }
      });
    });
  };
}
