import { createHash } from 'node:crypto';
import { approveProposal, attachSuggestion, confirmSuggestion, toReceipt } from '../packages/domain/core.js';

const assert = (condition, message) => { if (!condition) throw new Error(message); };

export function createCall({ id, question, zone }) {
  assert(typeof id === 'string' && id.trim(), 'id required');
  assert(typeof question === 'string' && question.trim(), 'question required');
  assert(zone && ['x', 'y', 'width', 'height'].every(k => Number.isFinite(zone[k])), 'invalid zone');
  assert(zone.x >= 0 && zone.y >= 0 && zone.width > 0 && zone.height > 0 && zone.x + zone.width <= 1 && zone.y + zone.height <= 1, 'zone outside video');
  return { id, question, zone: { ...zone }, state: 'proposed', viewers: [], receipt: null };
}

export function support(call, viewerId) {
  assert(call.state === 'proposed', 'proposal is closed');
  assert(typeof viewerId === 'string' && viewerId.trim(), 'viewer id required');
  if (!call.viewers.includes(viewerId)) call.viewers.push(viewerId);
  return call.viewers.length;
}

export function approve(call) {
  assert(call.state === 'proposed', 'proposal is not pending');
  call.shared = approveProposal({ id: call.id, question: call.question, rule: call.question, supporterIds: call.viewers, zone: { x: call.zone.x, y: call.zone.y, w: call.zone.width, h: call.zone.height }, status: 'proposed', eventTime: '' });
  call.state = 'open';
}

// Replay consumes recorded observations, never a viewer-provided verdict.
export function observe(call, observation) {
  assert(call.state === 'open', 'call is not open');
  assert(observation && typeof observation.eventTime === 'string' && Number.isFinite(Date.parse(observation.eventTime)), 'event time required');
  assert(typeof observation.evidence === 'string' && observation.evidence.length > 0, 'evidence required');
  let result = 'UNKNOWN';
  let rule = 'insufficient-evidence';
  if (observation.visible === true && observation.changed === true && Number.isFinite(observation.probability) && observation.probability >= 0 && observation.probability <= 1) {
    if (observation.probability >= 0.9) { result = 'YES'; rule = 'probability-high'; }
    else if (observation.probability <= 0.1) { result = 'NO'; rule = 'probability-low'; }
    else rule = 'probability-ambiguous';
  }
  call.receipt = { question: call.question, zone: { ...call.zone }, eventTime: observation.eventTime, evidenceHash: createHash('sha256').update(observation.evidence).digest('hex'), result, rule, confirmedBy: null };
  if (Number.isFinite(observation.probability) && observation.probability >= 0 && observation.probability <= 1) call.receipt.probability = observation.probability;
  call.shared = attachSuggestion({ ...call.shared, eventTime: observation.eventTime }, { verdict: result, reason: rule, evidenceHash: call.receipt.evidenceHash });
  call.state = 'awaiting_confirmation';
  return call.receipt;
}

export function confirm(call, streamerId) {
  assert(call.state === 'awaiting_confirmation', 'nothing to confirm');
  assert(typeof streamerId === 'string' && streamerId.trim(), 'streamer id required');
  call.shared = confirmSuggestion(call.shared);
  assert(toReceipt(call.shared)?.verdict === call.receipt.result, 'inconsistent verdict');
  call.receipt.confirmedBy = streamerId;
  call.state = call.receipt.result === 'UNKNOWN' ? 'canceled' : 'resolved';
  return call.receipt;
}

