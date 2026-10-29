import test from 'node:test';
import assert from 'node:assert/strict';
import { createCall, support, approve, observe, confirm } from '../src/call.js';

const make = () => createCall({ id: 'one', question: 'Is it there?', zone: { x: 0, y: 0, width: 0.5, height: 0.5 } });
const evidence = { eventTime: '2026-10-29T12:00:00Z', evidence: 'frame observation', visible: true, changed: true, probability: 0.95 };

test('deduplicates viewers and requires approval and confirmation', () => {
  const call = make();
  assert.equal(support(call, 'a'), 1);
  assert.equal(support(call, 'a'), 1);
  assert.equal(support(call, 'b'), 2);
  assert.throws(() => observe(call, evidence));
  approve(call);
  assert.equal(observe(call, evidence).result, 'YES');
  assert.equal(call.state, 'awaiting_confirmation');
  confirm(call, 'streamer');
  assert.equal(call.state, 'resolved');
  assert.throws(() => confirm(call, 'streamer'));
});

test('obscured, unchanged, ambiguous and invalid scores never become NO', () => {
  for (const patch of [{ visible: false, probability: 0 }, { changed: false, probability: 0 }, { probability: 0.5 }, { probability: -1 }, { probability: null }]) {
    const call = make(); approve(call);
    assert.equal(observe(call, { ...evidence, ...patch }).result, 'UNKNOWN');
    confirm(call, 'streamer');
    assert.equal(call.state, 'canceled');
  }
});

test('valid low observation produces NO and anchors event and evidence', () => {
  const call = make(); approve(call);
  const receipt = observe(call, { ...evidence, probability: 0.05 });
  assert.equal(receipt.result, 'NO');
  assert.equal(receipt.eventTime, evidence.eventTime);
  assert.match(receipt.evidenceHash, /^[a-f0-9]{64}$/);
});

test('rejects invalid zones and missing evidence', () => {
  assert.throws(() => createCall({ id: 'x', question: 'q', zone: { x: 0.9, y: 0, width: 0.2, height: 1 } }));
  const call = make(); approve(call);
  assert.throws(() => observe(call, { ...evidence, evidence: '' }));
  assert.equal(call.state, 'open');
});
