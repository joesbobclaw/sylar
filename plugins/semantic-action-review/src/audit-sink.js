import { appendFile, chmod, mkdir, stat } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";

export class JsonlAuditSink {
  #path;
  #queue = Promise.resolve();
  #maxBytes;

  constructor(path, { maxBytes = 50 * 1024 * 1024 } = {}) {
    if (!isAbsolute(path)) throw new TypeError("SAR auditPath must be absolute");
    this.#path = path;
    this.#maxBytes = maxBytes;
  }

  get path() { return this.#path; }

  append(record) {
    const task = this.#queue.then(async () => {
      await mkdir(dirname(this.#path), { recursive: true, mode: 0o700 });
      await chmod(dirname(this.#path), 0o700);
      const current = await stat(this.#path).catch(() => null);
      if (current && current.size >= this.#maxBytes) throw new Error("SAR audit file reached its size ceiling");
      await appendFile(this.#path, `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600 });
      await chmod(this.#path, 0o600);
    });
    this.#queue = task.catch(() => {});
    return task;
  }
}
