import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAnticipationService, parseCallCommand } from '../src/twitch/anticipations.js';
import { eventSubSubscription, ingestChatMessage, verifyEventSubSignature } from '../src/twitch/eventsub.js';

const operator = { id: 'mod-1', role: 'moderator' };
test('chat calls persist, deduplicate, limit spam, and produce a human-confirmed Unclear receipt', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'called-anticipations-')); let timestamp = 1_000_000;
  const service = createAnticipationService(path.join(dir, 'state.json'), { now: () => new Date(timestamp += 10_000).toISOString(), proposalCooldownMs: 1000 }); await service.load();
  try {
    const first = await service.propose({ channelId: 'channel', viewerId: 'viewer', text: 'the boss falls', eventId: 'event-1', receivedAt: '2026-01-01T00:00:00.000Z' }); assert.ok(first.proposal?.id);
    assert.equal((await service.propose({ channelId: 'channel', viewerId: 'viewer', text: 'the boss falls', eventId: 'event-1', receivedAt: '2026-01-01T00:00:01.000Z' })).duplicate, true);
    assert.equal((await service.propose({ channelId: 'channel', viewerId: 'viewer', text: 'another', eventId: 'event-2', receivedAt: '2026-01-01T00:00:00.500Z' })).rateLimited, true);
    const id = first.proposal.id; await service.transition({ id, actor: operator, action: 'accept' }); await service.transition({ id, actor: operator, action: 'open' });
    await assert.rejects(service.transition({ id, actor: { id: 'viewer', role: 'viewer' }, action: 'close', referenceTime: '2026-01-01T00:02:00Z' }));
    await service.transition({ id, actor: operator, action: 'close', referenceTime: '2026-01-01T00:02:00Z' });
    const resolved = await service.transition({ id, actor: operator, action: 'resolve', referenceTime: 'UNCLEAR' }); assert.equal(resolved.status, 'confirmed');
    const receipt = service.receipt(id); assert.deepEqual({ result: receipt.result, humanConfirmed: receipt.humanConfirmed, role: receipt.confirmedBy.role }, { result: 'UNCLEAR', humanConfirmed: true, role: 'moderator' });
    const restarted = createAnticipationService(path.join(dir, 'state.json')); await restarted.load(); assert.equal(restarted.receipt(id).result, 'UNCLEAR');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('only one channel call can be active and closed text cannot mutate', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'called-active-')); const service = createAnticipationService(path.join(dir, 'state.json'), { proposalCooldownMs: 0 }); await service.load();
  try {
    const one = (await service.propose({ channelId: 'c', viewerId: 'a', text: 'one', eventId: '1', receivedAt: '2026-01-01T00:00:00Z' })).proposal.id;
    const two = (await service.propose({ channelId: 'c', viewerId: 'b', text: 'two', eventId: '2', receivedAt: '2026-01-01T00:00:01Z' })).proposal.id;
    await service.transition({ id: one, actor: operator, action: 'accept' }); await assert.rejects(service.transition({ id: two, actor: operator, action: 'accept' }));
    await service.transition({ id: one, actor: operator, action: 'close', referenceTime: '2026-01-01T00:01:00Z' }); await assert.rejects(service.transition({ id: one, actor: operator, action: 'accept' }));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('EventSub signature is verified before a chat command is ingested', async () => {
  const secret = '0123456789secret'; const raw = Buffer.from(JSON.stringify({ event: {} })); const id = 'event'; const timestamp = '2026-01-01T00:00:00Z';
  const signature = `sha256=${createHmac('sha256', secret).update(id).update(timestamp).update(raw).digest('hex')}`;
  assert.equal(verifyEventSubSignature({ headers: { 'twitch-eventsub-message-id': id, 'twitch-eventsub-message-timestamp': timestamp, 'twitch-eventsub-message-signature': signature }, rawBody: raw, secret }), true);
  assert.equal(verifyEventSubSignature({ headers: { 'twitch-eventsub-message-id': id, 'twitch-eventsub-message-timestamp': timestamp, 'twitch-eventsub-message-signature': signature.replace(/.$/, '0') }, rawBody: raw, secret }), false);
  assert.equal(parseCallCommand('!call boss falls'), 'boss falls'); assert.equal(parseCallCommand('hello'), null);
  const proposed = []; const result = await ingestChatMessage({ service: { propose: async input => { proposed.push(input); return { proposal: input }; } }, eventId: id, event: { broadcaster_user_id: 'channel', chatter_user_id: 'viewer', message: { text: '!call boss falls' } } }); assert.equal(result.proposal.text, 'boss falls'); assert.equal(proposed[0].viewerId.includes('viewer'), false);
  assert.equal(eventSubSubscription({ broadcasterId: 'channel', botUserId: 'bot', callback: 'https://example.test/eventsub', secret }).type, 'channel.chat.message');
});

test('chat server handles signed EventSub verification and never accepts a caller-supplied operator', async () => {
  const { startChatServer } = await import('../src/twitch/chat-server.js'); const dir = await mkdtemp(path.join(os.tmpdir(), 'called-chat-server-')); const secret = '0123456789secret'; const key = 'k'.repeat(32);
  const server = await startChatServer({ port: 0, file: path.join(dir, 'state.json'), eventSubSecret: secret, operatorKey: key, operator: { id: 'streamer', role: 'broadcaster' } }); const url = `http://127.0.0.1:${server.address().port}`;
  const body = JSON.stringify({ challenge: 'accepted' }); const id = 'verify-1'; const timestamp = '2026-01-01T00:00:00Z'; const signature = `sha256=${createHmac('sha256', secret).update(id).update(timestamp).update(body).digest('hex')}`;
  try {
    const response = await fetch(`${url}/eventsub`, { method: 'POST', headers: { 'twitch-eventsub-message-id': id, 'twitch-eventsub-message-timestamp': timestamp, 'twitch-eventsub-message-signature': signature, 'twitch-eventsub-message-type': 'webhook_callback_verification' }, body }); assert.equal(await response.text(), 'accepted');
    const bad = await fetch(`${url}/api/anticipations/action`, { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ id: 'x', action: 'accept', actor: { id: 'spoof', role: 'moderator' } }) }); assert.equal(bad.status, 400);
  } finally { await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); }
});
