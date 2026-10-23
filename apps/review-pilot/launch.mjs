import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
const settings = JSON.parse(await readFile(new URL("../../.tmp/review-pilot/launch.json", import.meta.url)));
const env = { ...process.env, PORT: "18794", PUBLIC_URL: settings.publicUrl, PILOT_BOOT_KEY: settings.bootKey,
  OPENCLAW_CLI_MODULE: "/usr/local/lib/node_modules/openclaw/dist/cli/run-main.js",
  PILOT_STATE_DIR: new URL("../../.tmp/review-pilot/", import.meta.url).pathname,
  PILOT_ALLOW_PROSPECTIVE: "0" };
delete env.NODE_OPTIONS;
const child = spawn(process.execPath, [new URL("./server.mjs", import.meta.url).pathname], { stdio: "inherit", env });
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
child.on("close", (code) => process.exit(code ?? 1));
