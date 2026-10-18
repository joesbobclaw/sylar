// One inference per disposable process, no tools, no agent/session execution.
// The caller starts this with core dumps disabled and kills it on cancellation.
import { pathToFileURL } from "node:url";
try {
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
    if (Buffer.byteLength(input) > 512 * 1024) throw new Error();
  }
  const { prompt, model, cliModule } = JSON.parse(input);
  input = "";
  const write = process.stdout.write.bind(process.stdout);
  let output = "";
  process.stdout.write = (chunk) => {
    output += String(chunk);
    if (Buffer.byteLength(output) > 32768) throw new Error();
    return true;
  };
  process.stderr.write = () => true;
  // Stable installed CLI entry. Raw input is only in this JS array, not OS argv.
  const { runCli } = await import(pathToFileURL(cliModule).href);
  await runCli([process.execPath, "openclaw", "--log-level", "silent", "infer", "model", "run", "--local", "--json", "--model", model, "--prompt", prompt]);
  const result = JSON.parse(output);
  const candidate = result.outputs?.[0]?.text ?? result.outputText ?? result.text ?? result.output ?? result.result?.text;
  const decision = JSON.parse(candidate);
  if (!decision || !["allow", "approval_required", "human_only", "deny"].includes(decision.outcome)) throw new Error();
  write(JSON.stringify({ outcome: decision.outcome }));
  process.exit(0);
} catch {
  process.exit(1);
}
