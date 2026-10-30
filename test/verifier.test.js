import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRedSample } from '../src/local/verifier.js';
const sample = { kind: 'red-pixel-v1', count: 1000, red: 210, meanLight: 100, hash: 'a'.repeat(64), capturedAt: '2026-10-29T12:00:00.000Z' };
test('red sample passes only the documented threshold', () => { assert.equal(evaluateRedSample(sample).verdict, 'YES'); assert.equal(evaluateRedSample({ ...sample, red: 199 }).verdict, 'UNKNOWN'); });
test('insufficient or invalid observations are UNKNOWN', () => { for (const patch of [{ count: 5 }, { meanLight: 5 }, { red: 1001 }, { hash: '' }, { capturedAt: '' }]) assert.equal(evaluateRedSample({ ...sample, ...patch }).verdict, 'UNKNOWN'); });
