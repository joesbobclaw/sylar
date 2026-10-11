#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { buildShadowReport } from "../src/shadow-report.js";

const args = process.argv.slice(2);
const path = args.find((arg) => !arg.startsWith("--")) ?? join(homedir(), ".openclaw", "audit", "sar-shadow.jsonl");
const sinceArg = args.find((arg) => arg.startsWith("--since="));
const since = sinceArg ? Date.parse(sinceArg.slice("--since=".length)) : null;
if (sinceArg && !Number.isFinite(since)) throw new Error(`Invalid --since timestamp: ${sinceArg.slice("--since=".length)}`);
const input = await readFile(path, "utf8");
const records = input.split("\n").filter(Boolean).map((line, index) => {
  try { return JSON.parse(line); }
  catch (error) { throw new Error(`Invalid JSONL at line ${index + 1}: ${error.message}`); }
}).filter((record) => since === null || Date.parse(record.timestamp) >= since);
process.stdout.write(`${JSON.stringify(buildShadowReport(records), null, 2)}\n`);
