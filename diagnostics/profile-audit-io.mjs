#!/usr/bin/env node
// Isolated synthetic diagnostic: production source, changed IO import only.
// No live audit/log files, tool calls, model requests, config or plugin edits.
import { readFile, mkdtemp, rm, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import assert from "node:assert/strict";
import { resetProfile, readProfile } from "./profile-fs.mjs";
const source = await readFile(new URL("../plugins/semantic-action-review/src/audit-sink.js", import.meta.url), "utf8");
const expected = 'import { appendFile, chmod, mkdir, stat } from "node:fs/promises";';
assert.equal(source.split(expected).length, 2, "Unknown source import; diagnostic not applied");
const wrapped = source.replace(expected, `import { appendFile, chmod, mkdir, stat } from ${JSON.stringify(new URL("./profile-fs.mjs", import.meta.url).href)};`);
const { JsonlAuditSink } = await import(`data:text/javascript;base64,${Buffer.from(wrapped).toString("base64")}`);
const summarize = (values) => {
 const sorted = [...values].sort((a,b) => a-b);
 return { count: sorted.length, totalMs: sorted.reduce((sum,x) => sum+x, 0),
  p50Ms: sorted[Math.floor(sorted.length*.5)], p95Ms: sorted[Math.floor(sorted.length*.95)], maxMs: sorted.at(-1) };
};
const dir = await mkdtemp(join(tmpdir(), "sylar-io-profile-"));
const results = [];
try {
 for (const concurrency of [1, 4, 16, 32]) {
  resetProfile();
  const path = join(dir, `c${concurrency}`, "audit.jsonl");
  const sink = new JsonlAuditSink(path);
  const durations = [];
  let next = 0;
  const count = 512;
  const start = performance.now();
  await Promise.all(Array.from({length:concurrency}, async () => {
   while (next < count) {
    const index = next++;
    const began = performance.now();
    await sink.append({schemaVersion:2,recordType:"diagnostic_synthetic",mode:"shadow",enforced:false,sequence:index});
    durations.push(performance.now()-began);
   }
  }));
  const elapsedMs = performance.now()-start;
  const io = readProfile();
  assert.equal(io.mkdir.length,count); assert.equal(io.chmod.length,count*2);
  assert.equal(io.stat.length,count); assert.equal(io.appendFile.length,count);
  const rows=(await readFile(path,"utf8")).trim().split("\n").map(JSON.parse);
  assert.equal(rows.length,count);
  assert.equal(new Set(rows.map(row=>row.sequence)).size,count);
  assert.equal((await stat(path)).mode&0o777,0o600);
  assert.equal((await stat(join(dir,`c${concurrency}`))).mode&0o777,0o700);
  const append = summarize(durations);
  const filesystem = Object.fromEntries(Object.entries(io).map(([key,value])=>[key,summarize(value)]));
  const totalIoMs=Object.values(filesystem).reduce((sum,item)=>sum+item.totalMs,0);
  results.push({concurrency,records:count,elapsedMs,appendLatencyIncludingSerialQueue:append,filesystem,
   averagePerRecordIoMs:totalIoMs/count,
   averageQueueAndJsMs:Math.max(0,(append.totalMs-totalIoMs)/count),
   note:"Queue/JS residual is diagnostic approximation, not a production causal attribution. Instrumentation and host load affect timings."});
 }
} finally { await rm(dir,{recursive:true,force:true}); }
console.log(JSON.stringify({sourceSha256:createHash("sha256").update(source).digest("hex"),
 scope:"isolated synthetic filesystem/queue diagnostic; not production hook overhead",originalAlgorithmUnchanged:true,
 allRecordsAndModesVerified:true,results},null,2));
