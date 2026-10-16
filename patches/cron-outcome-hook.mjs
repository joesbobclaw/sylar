// Version-pinned local compatibility patch; never applied automatically on update.
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const baselineSha256 = "c6599dde077cb122af03c05bf8c272938d04ae45ece31f7745daf6bf54041bf2";
export const patchedSha256 = "fefc9f8ff078b1f8857529199281d2c48802d6c9dd4cfb24b45209d4928916fc";
export const targetName = "server-cron-DO6g_stF.mjs";
const before = `executeTool: (call) => withGatewayToolCallerIdentity(caller, async () => {
\t\t\t\t\tassertActive();
\t\t\t\t\tconst result = await wrapToolWithAbortSignal(rewrapToolWithBeforeToolCallHook(bindAgentToolSourceExecutionGuard(call.tool, assertActive)), evaluationScope.signal).execute(call.toolCallId, call.input, call.signal, call.onUpdate);
\t\t\t\t\tassertActive();
\t\t\t\t\treturn await call.acceptResultBeforeProjection(result);
\t\t\t\t})`;

export const after = `executeTool: (call) => withGatewayToolCallerIdentity(caller, async () => {
\t\t\t\t\tassertActive();
\t\t\t\t\t// Sylar cron-outcome-hook v1: observe execution, not projection success.
\t\t\t\t\tconst startedAt = Date.now();
\t\t\t\t\tlet result;
\t\t\t\t\tlet executionError;
\t\t\t\t\ttry {
\t\t\t\t\t\t\tresult = await wrapToolWithAbortSignal(rewrapToolWithBeforeToolCallHook(bindAgentToolSourceExecutionGuard(call.tool, assertActive)), evaluationScope.signal).execute(call.toolCallId, call.input, call.signal, call.onUpdate);
\t\t\t\t\t\t\tif (result?.isError === true) executionError = "tool-result-error";
\t\t\t\t\t\t} catch (error) {
\t\t\t\t\t\t\texecutionError = "tool-execution-error";
\t\t\t\t\t\t\tthrow error;
\t\t\t\t\t\t} finally {
\t\t\t\t\t\t\t// The native helper isolates plugin failures. Observation must not
\t\t\t\t\t\t\t// replace the tool result/error, even if the helper itself fails.
\t\t\t\t\t\t\ttry {
\t\t\t\t\t\t\t\tawait runAgentHarnessAfterToolCallHook({
\t\t\t\t\t\t\t\t\ttoolName: call.tool.name, toolCallId: call.toolCallId,
\t\t\t\t\t\t\t\t\trunId, agentId: runtime.context.agentId,
\t\t\t\t\t\t\t\t\tsessionKey: runtime.context.sessionKey,
\t\t\t\t\t\t\t\t\tstartArgs: call.input, result, error: executionError, startedAt
\t\t\t\t\t\t\t\t});
\t\t\t\t\t\t\t} catch {}
\t\t\t\t\t\t}
\t\t\t\t\tassertActive();
\t\t\t\t\treturn await call.acceptResultBeforeProjection(result);
\t\t\t\t})`;

export function patchCronBundle(source) {
  const hash = createHash("sha256").update(source).digest("hex");
  if (hash === patchedSha256) return source;
  if (hash !== baselineSha256)
    throw new Error("Unsupported OpenClaw bundle hash; inspect the new execution seam first");
  if (source.split(before).length !== 2) throw new Error("Expected exactly one cron execution seam");
  return 'import { t as runAgentHarnessAfterToolCallHook } from "./hook-helpers-fjOB2Pu1.mjs";\n' + source.replace(before, after);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const path = process.argv[2];
  if (!path?.endsWith(`/${targetName}`)) throw new Error("Pass the pinned server-cron bundle path");
  const source = await readFile(path, "utf8");
  const patched = patchCronBundle(source);
  if (process.argv[3] === "--apply") await writeFile(path, patched);
  process.stdout.write(`${patched === source ? "already-patched" : process.argv[3] === "--apply" ? "patched" : "validated-dry-run"}\n`);
}
