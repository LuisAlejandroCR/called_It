import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ACTIVE = new Set(['accepted', 'participation_open', 'closed']);
const RESULTS = new Set(['CORRECT', 'INCORRECT', 'UNCLEAR']);
const isText = value => typeof value === 'string' && value.trim().length > 0;
const clone = value => structuredClone(value);
const fail = message => { throw new Error(message); };

// A deliberately small, persistent domain for chat-first calls. It retains the
// accepted text and opaque author ID, not a transcript or viewer profile.
export function createAnticipationService(file, { now = () => new Date().toISOString(), maxSeenEvents = 1000, proposalCooldownMs = 10_000 } = {}) {
  let state = { version: 1, proposals: [], receipts: [], seenEventIds: [], lastProposalAt: {}, revocations: [] };
  let queue = Promise.resolve();
  async function load() { try { state = { ...state, ...JSON.parse(await readFile(file, 'utf8')) }; } catch (error) { if (error.code !== 'ENOENT') throw error; } }
  async function persist(next) { await mkdir(path.dirname(file), { recursive: true }); const temp = `${file}.${randomUUID()}.tmp`; await writeFile(temp, JSON.stringify(next, null, 2), { mode: 0o600, flag: 'wx' }); await rename(temp, file); }
  const run = operation => { const result = queue.then(operation); queue = result.catch(() => {}); return result; };
  const activeFor = (next, channelId) => next.proposals.find(call => call.channelId === channelId && ACTIVE.has(call.status));
  const commit = operation => run(async () => { const next = clone(state); const value = await operation(next); await persist(next); state = next; return value; });
  return {
    load,
    snapshot: () => clone(state),
    propose({ channelId, viewerId, text, eventId, receivedAt = now() }) { return commit(next => {
      if (!isText(channelId) || !isText(viewerId) || !isText(text) || text.trim().length > 240 || !isText(eventId)) fail('Invalid proposal');
      if (next.seenEventIds.includes(eventId)) return { duplicate: true, proposal: null };
      next.seenEventIds.push(eventId); if (next.seenEventIds.length > maxSeenEvents) next.seenEventIds.splice(0, next.seenEventIds.length - maxSeenEvents);
      const previous = Number(next.lastProposalAt[`${channelId}:${viewerId}`] ?? 0); const current = Date.parse(receivedAt);
      if (!Number.isFinite(current)) fail('Invalid proposal time');
      if (current - previous < proposalCooldownMs) return { duplicate: false, rateLimited: true, proposal: null };
      next.lastProposalAt[`${channelId}:${viewerId}`] = current;
      const proposal = { id: randomUUID(), channelId, text: text.trim(), authorId: viewerId, status: 'proposed', proposedAt: receivedAt };
      next.proposals.unshift(proposal); return { duplicate: false, rateLimited: false, proposal: clone(proposal) };
    }); },
    transition({ id, actor, action, referenceTime }) { return commit(next => {
      if (!isText(id) || !actor || !isText(actor.id) || !['broadcaster', 'moderator'].includes(actor.role)) fail('Unauthorized operator');
      const call = next.proposals.find(item => item.id === id); if (!call) fail('Call not found');
      const at = now();
      if (action === 'accept') {
        if (call.status !== 'proposed') fail('Only proposals can be accepted');
        if (activeFor(next, call.channelId)) fail('Only one active call is allowed per channel');
        call.status = 'accepted'; call.acceptedAt = at; call.acceptedBy = { id: actor.id, role: actor.role };
      } else if (action === 'reject') {
        if (call.status !== 'proposed') fail('Only proposals can be rejected'); call.status = 'rejected'; call.rejectedAt = at; call.rejectedBy = { id: actor.id, role: actor.role };
      } else if (action === 'open') {
        if (call.status !== 'accepted') fail('Only accepted calls can open participation'); call.status = 'participation_open'; call.openedAt = at;
      } else if (action === 'close') {
        if (!['accepted', 'participation_open'].includes(call.status)) fail('Only an open call can close');
        if (!isText(referenceTime) || !Number.isFinite(Date.parse(referenceTime))) fail('A valid pre-outcome reference time is required');
        if (Date.parse(referenceTime) > Date.parse(at)) fail('The close reference cannot be after the close time');
        call.status = 'closed'; call.closedAt = at; call.referenceTime = referenceTime; call.closedBy = { id: actor.id, role: actor.role };
      } else if (action === 'resolve') {
        if (call.status !== 'closed' || !RESULTS.has(referenceTime)) fail('Only a closed call can receive a valid result');
        call.status = 'confirmed'; call.result = referenceTime; call.confirmedAt = at; call.confirmedBy = { id: actor.id, role: actor.role };
        next.receipts.unshift({ callId: call.id, channelId: call.channelId, text: call.text, closedAt: call.closedAt, referenceTime: call.referenceTime, result: call.result, confirmedAt: call.confirmedAt, confirmedBy: clone(call.confirmedBy), humanConfirmed: true });
      } else fail('Unknown transition');
      return clone(call);
    }); },
    receipt(id) { const value = state.receipts.find(item => item.callId === id); return value ? clone(value) : null; }
    ,recordRevocation({ eventId, subscriptionId, channelId, status, receivedAt = now() }) { return commit(next => {
      if (![eventId, subscriptionId, channelId, status].every(isText)) fail('Invalid revocation');
      if (next.revocations.some(item => item.eventId === eventId)) return { duplicate: true };
      next.revocations.unshift({ eventId, subscriptionId, channelId, status, receivedAt }); if (next.revocations.length > 100) next.revocations.length = 100;
      return { duplicate: false };
    }); }
  };
}

export function parseCallCommand(message) {
  if (typeof message !== 'string') return null;
  const match = /^!call\s+(.+)$/i.exec(message.trim());
  return match && match[1].trim().length <= 240 ? match[1].trim() : null;
}

// Do not retain a raw chatter identity in diagnostics. The caller may use this
// deterministic pseudonym when an EventSub user ID must not reach the UI.
export const pseudonymousViewerId = (channelId, viewerId) => createHash('sha256').update(`${channelId}:${viewerId}`).digest('hex');
