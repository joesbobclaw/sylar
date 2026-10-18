#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { buildLabelReport } from "../src/label-report.js";
try {
  // Pipe only privacy-minimized metadata; raw effects never belong on stdin.
  const text = await readFile(0, "utf8");
  if (text.length > 1024 * 1024) throw new Error();
  const rows = text.split("\n").filter(Boolean).map((line) => JSON.parse(line));
  if (rows.length > 1000) throw new Error();
  process.stdout.write(`${JSON.stringify(buildLabelReport(rows), null, 2)}\n`);
} catch {
  process.stderr.write("Invalid or unavailable label metadata; no input values disclosed.\n");
  process.exitCode = 1;
}
