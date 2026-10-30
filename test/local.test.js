import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../src/local/server.js';

test('local API persists lifecycle and rejects client verdicts', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'called-it-')); const file = path.join(dir, 'state.json');
  let server = await startServer({ port: 0, file });
  const api = () => `http://127.0.0.1:${server.address().port}`;
  const post = (action, input) => fetch(api() + '/api/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, input }) });
  try {
    let response = await post('create', { question: 'Will it boil?', rule: 'Before the timer ends', zone: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 } });
    let state = await response.json(); const id = state.calls[0].id;
    await post('support', { id, viewerId: 'a' }); await post('support', { id, viewerId: 'a' });
    state = await (await post('support', { id, viewerId: 'b' })).json(); assert.equal(state.calls[0].supporterIds.length, 2);
    assert.equal((await post('observe', { id, verdict: 'YES' })).status, 400);
    assert.equal((await post('confirm', { id })).status, 400);
    await post('approve', { id }); state = await (await post('observe', { id })).json();
    assert.equal(state.calls[0].suggestion.verdict, 'UNKNOWN'); assert.match(state.calls[0].suggestion.evidenceHash, /^[0-9a-f]{64}$/);
    state = await (await post('confirm', { id })).json(); assert.equal(state.receipts[0].verdict, 'UNKNOWN'); assert.equal(state.receipts[0].canceled, true);
    await new Promise(r => server.close(r)); server = await startServer({ port: 0, file });
    state = await (await fetch(api() + '/api/state')).json(); assert.equal(state.receipts.length, 1); assert.equal(state.calls[0].status, 'confirmed');
    state = await (await post('create', { question: 'Second?', rule: 'Rule', zone: { x: 0, y: 0, w: 1, h: 1 } })).json(); const other = state.calls[1].id;
    await post('approve', { id: other }); await post('observe', { id: other }); state = await (await post('reject-suggestion', { id: other })).json();
    assert.equal(state.receipts.length, 1); assert.equal(state.calls[1].finalVerdict, undefined);
  } finally { await new Promise(r => server.close(r)); await rm(dir, { recursive: true, force: true }); }
});

test('camera metrics are classified on the server and only summaries persist', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'called-camera-')); const file = path.join(dir, 'state.json');
  const server = await startServer({ port: 0, file }); const url = `http://127.0.0.1:${server.address().port}/api/action`;
  const post = async (action, input) => { const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, input }) }); return { status: r.status, data: await r.json() }; };
  try {
    let r = await post('create', { question: 'Is the zone red?', rule: 'At least 20% of pixels in the selected zone are strongly red.', zone: { x: 0, y: 0, w: 1, h: 1 } }); const id = r.data.calls[0].id;
    await post('approve', { id });
    const sample = { kind: 'red-pixel-v1', count: 1000, red: 250, meanLight: 100, hash: 'a'.repeat(64), capturedAt: '2026-10-29T12:00:00.000Z' };
    r = await post('observe', { id, sample }); assert.equal(r.data.calls[0].suggestion.verdict, 'YES'); assert.equal(r.data.calls[0].eventTime, sample.capturedAt); assert.equal(r.data.calls[0].suggestion.source, 'camera-metrics');
    r = await post('confirm', { id }); assert.equal(r.data.receipts[0].source, 'camera-metrics'); assert.equal(r.data.receipts[0].eventTime, sample.capturedAt);
    const stored = await (await import('node:fs/promises')).readFile(file, 'utf8'); assert.equal(stored.includes('meanLight'), false); assert.equal(stored.includes('red-pixel-v1'), false);
  } finally { await new Promise(r => server.close(r)); await rm(dir, { recursive: true, force: true }); }
});

test('verifier failure degrades to UNKNOWN and remains confirmable', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'called-verifier-'));
  try {
    const { createService } = await import('../src/local/service.js');
    const service = createService(path.join(dir, 'state.json'), { verify: () => { throw new Error('failure'); } });
    await service.load(); let state = await service.dispatch('create', { question: 'Red?', rule: 'At least 20% of pixels in the selected zone are strongly red.', zone: { x: 0, y: 0, w: 1, h: 1 } });
    const id = state.calls[0].id; await service.dispatch('approve', { id });
    state = await service.dispatch('observe', { id, sample: { capturedAt: '2026-10-29T12:00:00.000Z', hash: 'a'.repeat(64) } });
    assert.equal(state.calls[0].suggestion.verdict, 'UNKNOWN'); assert.equal(state.calls[0].suggestion.reason, 'Verifier failed.');
    state = await service.dispatch('confirm', { id }); assert.equal(state.receipts[0].canceled, true);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
