import { readFile } from 'node:fs/promises';
import { createCall, support, approve, observe, confirm } from './call.js';

try {
  const path = process.argv[2];
  if (!path) throw new Error('Usage: node src/replay.js <fixture.json>');
  const fixture = JSON.parse(await readFile(path, 'utf8'));
  const receipts = fixture.calls.map(item => {
    const call = createCall(item);
    for (const viewer of item.viewers) support(call, viewer);
    approve(call);
    observe(call, item.observation);
    confirm(call, fixture.streamer);
    return { id: call.id, distinctViewers: call.viewers.length, state: call.state, receipt: call.receipt };
  });
  console.log(JSON.stringify(receipts, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
