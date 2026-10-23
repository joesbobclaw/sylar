import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile, appendFile, mkdir, chmod, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PilotService } from "./service.mjs";
import { createReviewer } from "./reviewer.mjs";

const same = (a, b) => typeof a === "string" && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export function createPilotServer({ reviewer, publicUrl, parentOrigin, bootKey = randomBytes(32).toString("hex"), ingestKey = randomBytes(32).toString("hex"), persist,
  allowProspective = false, ttlMs, now = Date.now, bootTtlMs = 30 * 60000, sessionTtlMs = 30 * 60000 } = {}) {
  const csrf = randomBytes(32).toString("hex");
  const cookie = randomBytes(32).toString("hex");
  const publicAddress = new URL(publicUrl);
  const origin = publicAddress.origin;
  const basePath = publicAddress.pathname.endsWith("/") ? publicAddress.pathname : `${publicAddress.pathname}/`;
  const bootExpiresAt = now() + bootTtlMs;
  let bootUsed = false;
  let sessionExpiresAt = 0;
  const service = new PilotService({ reviewer, persist, allowProspective, ttlMs });
  let bodyReaders = 0;
  const assets = { "/": ["index.html", "text/html"], "/app.js": ["app.js", "text/javascript"], "/style.css": ["style.css", "text/css"] };
  const server = createServer(async (req, res) => {
    const requestPath = new URL(req.url, "http://localhost").pathname;
    const path = requestPath.startsWith(basePath) ? `/${requestPath.slice(basePath.length)}` : null;
    const headers = { "Cache-Control": "no-store, max-age=0", "Pragma": "no-cache",
      "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin", "Cross-Origin-Opener-Policy": "same-origin", "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Content-Security-Policy": `default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors ${parentOrigin ? "'self' " + new URL(parentOrigin).origin : "'none'"}` };
    const reply = (status, data) => { if (!res.headersSent) res.writeHead(status, { ...headers, "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
    if (basePath !== "/" && requestPath === basePath.slice(0, -1)) { res.writeHead(308, { ...headers, Location: basePath }); res.end(); return; }
    if (!path) { reply(404, { error: "not_found" }); return; }
    let bodySlot = false;
    try {
      if (req.method === "GET" && assets[path]) {
        const [file, contentType] = assets[path];
        res.writeHead(200, { ...headers, "Content-Type": contentType });
        res.end(await readFile(new URL(`./public/${file}`, import.meta.url)));
        return;
      }
      const cookies = Object.fromEntries((req.headers.cookie ?? "").split(";").map((part) => part.trim().split("=")));
      const authenticated = same(cookies.pilot, cookie) && now() < sessionExpiresAt;
      const ingest = same(req.headers.authorization, `Bearer ${ingestKey}`);
      if (req.method === "GET") {
        if (!authenticated || !same(req.headers["x-pilot-csrf"], csrf)) { reply(401, { error: "locked" }); return; }
        if (path === "/api/current") reply(200, { item: service.current() });
        else if (path === "/api/session") reply(200, { csrf, allowProspective });
        else if (path === "/api/report") reply(200, service.report());
        else reply(404, { error: "not_found" });
        return;
      }
      if (req.method !== "POST") { reply(405, { error: "method" }); return; }
      if (req.headers.origin !== origin && !(ingest && path === "/api/admit")) { reply(403, { error: "origin" }); return; }
      if (path !== "/api/session" && !(ingest && path === "/api/admit") &&
          !(authenticated && same(req.headers["x-pilot-csrf"], csrf))) { reply(403, { error: "locked" }); return; }
      if (req.headers["content-type"] !== "application/json") { reply(415, { error: "content_type" }); return; }
      if (bodyReaders >= 4) { reply(429, { error: "capacity" }); return; }
      bodyReaders++; bodySlot = true;
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 256 * 1024) { reply(413, { error: "size" }); return; }
        chunks.push(chunk);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (path === "/api/session") {
        if (!same(body.key, bootKey) || (!authenticated && (bootUsed || now() >= bootExpiresAt))) { reply(401, { error: "link_expired" }); return; }
        if (!authenticated) { bootUsed = true; sessionExpiresAt = now() + sessionTtlMs; }
        res.setHeader("Set-Cookie", `pilot=${cookie}; HttpOnly; Path=${basePath}; Max-Age=${Math.max(0, Math.floor((sessionExpiresAt - now()) / 1000))}; SameSite=Strict${origin.startsWith("https:") ? "; Secure" : ""}`);
        reply(200, { csrf, allowProspective });
      } else if (path === "/api/admit") {
        if (!body || Object.keys(body).sort().join(",") !== "category,effect,source") { reply(400, { error: "admission_rejected" }); return; }
        reply(200, await service.admit(body));
      } else if (path === "/api/label") {
        if (Object.keys(body).sort().join(",") !== "decision,humanIndependent,sampleId") { reply(400, { error: "label_rejected" }); return; }
        reply(200, await service.label(body));
      } else if (path === "/api/cancel") {
        service.remove(); reply(200, { cancelled: true });
      } else reply(404, { error: "not_found" });
    } catch { reply(400, { error: "request_rejected" }); }
    finally { if (bodySlot) bodyReaders--; }
  });
  server.requestTimeout = 35000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 1000;
  return { server, service, bootKey, ingestKey, csrf };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 18794);
  const publicUrl = process.env.PUBLIC_URL ?? `http://127.0.0.1:${port}/`;
  const stateDir = resolve(process.env.PILOT_STATE_DIR ?? ".tmp/review-pilot");
  await mkdir(stateDir, { recursive: true, mode: 0o700 });
  await chmod(stateDir, 0o700);
  const reviewer = createReviewer({ cliModule: process.env.OPENCLAW_CLI_MODULE });
  const id = randomBytes(8).toString("hex");
  const metadataPath = resolve(stateDir, `labels-${id}.jsonl`);
  const persist = async (row) => {
    await appendFile(metadataPath, `${JSON.stringify(row)}\n`, { mode: 0o600 });
    await chmod(metadataPath, 0o600);
  };
  const bootKey = process.env.PILOT_BOOT_KEY ?? randomBytes(32).toString("hex");
  process.on("uncaughtException", () => process.exit(1));
  process.on("unhandledRejection", () => process.exit(1));
  const app = createPilotServer({ reviewer, publicUrl, bootKey, persist,
    parentOrigin: process.env.PILOT_PARENT_ORIGIN,
    allowProspective: process.env.PILOT_ALLOW_PROSPECTIVE === "1" });
  const runtimeFile = resolve(stateDir, "runtime.json");
  await writeFile(runtimeFile, JSON.stringify({ pid: process.pid, port, bootKey, ingestKey: app.ingestKey, metadataPath }), { mode: 0o600 });
  await chmod(runtimeFile, 0o600);
  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    app.service.shutdown();
    await writeFile(resolve(stateDir, `report-${id}.json`), JSON.stringify(app.service.report(), null, 2), { mode: 0o600 });
    app.server.closeAllConnections();
    app.server.close(() => process.exit(0));
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  // Deliberately no access logs, request bodies, model output, URLs or error text.
  app.server.listen(port, "127.0.0.1", () => process.stdout.write("Sylar private pilot listening on loopback.\n"));
}
