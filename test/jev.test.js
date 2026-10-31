import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../src/jev/oracle.js';
const base = { question: 'Is the pot overflowing?', observations: ['Liquid is visible outside the pot.'], visible: true, changed: true, eventTime: '2026-10-29T12:00:00Z', evidenceHash: 'a'.repeat(64) };
const thresholds = { low: 0.1, high: 0.9 };
test('replay classifies observations and preserves event evidence', async () => {
  const result = await evaluate(base, { thresholds, classify: async () => 0.95 });
  assert.equal(result.verdict, 'YES'); assert.equal(result.eventTime, base.eventTime); assert.equal(result.evidenceHash, base.evidenceHash);
});
test('insufficient evidence never invokes classifier', async () => {
  let calls = 0;
  for (const patch of [{ visible: false }, { changed: false }, { evidenceHash: null }, { eventTime: '2026-10-29T12:00:00' }]) {
    assert.equal((await evaluate({ ...base, ...patch }, { thresholds, classify: async () => { calls++; return 0; } })).verdict, 'UNKNOWN');
  }
  assert.equal(calls, 0);
});
test('missing thresholds, ambiguous output, errors and malformed responses fail closed', async () => {
  for (const options of [{ classify: async () => 0 }, { thresholds, classify: async () => 0.5 }, { thresholds, classify: async () => NaN }, { thresholds, classify: async () => { throw Error('offline'); } }]) assert.equal((await evaluate(base, options)).verdict, 'UNKNOWN');
});
