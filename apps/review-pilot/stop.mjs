import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
try {
 const state = JSON.parse(await readFile(new URL("../../.tmp/review-pilot/runtime.json", import.meta.url)));
 const command = execFileSync("ps", ["-p", String(state.pid), "-o", "command="], { encoding: "utf8" });
 if (!command.includes("review-pilot/server.mjs")) throw new Error();
 process.kill(state.pid, "SIGTERM");
 process.stdout.write("Pilot stop requested; live SAR plugin unchanged. Close its Portal in Control UI.\n");
} catch { process.stdout.write("No verified pilot process to stop.\n"); }
