import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

// Single-process journal. Do not share its file with another process.
export function createJournal(file) {
  let queue = Promise.resolve();
  const run = fn => { const p = queue.then(fn); queue = p.catch(() => {}); return p; };
  async function read() { try { return JSON.parse(await readFile(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return {}; throw e; } }
  async function write(data) { await mkdir(path.dirname(file), { recursive: true }); const tmp = `${file}.${randomUUID()}.tmp`; await writeFile(tmp, JSON.stringify(data), { flag: 'wx', mode: 0o600 }); await rename(tmp, file); }
  return {
    get: id => run(async () => (await read())[id]),
    compareAndSet: (id, expected, value) => run(async () => { const data = await read(); const actual = data[id]?.state ?? null; if (actual !== expected) return false; data[id] = value; await write(data); return true; }),
  };
}
