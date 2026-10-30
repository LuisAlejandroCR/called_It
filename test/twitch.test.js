import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { validateBroadcaster, predictionClient } from '../src/twitch/helix.js';
import { extensionIdentity } from '../src/twitch/extension.js';
const valid = { client_id: 'client', user_id: 'channel', scopes: ['channel:manage:predictions'], expires_in: 100 };
test('validates broadcaster identity, scope and expiry', async () => {
  const args = { token: 'token', clientId: 'client', broadcasterId: 'channel', fetchImpl: async () => ({ ok: true, json: async () => valid }) };
  assert.equal((await validateBroadcaster(args)).broadcasterId, 'channel');
  for (const patch of [{ user_id: 'other' }, { scopes: [] }, { expires_in: 0 }]) await assert.rejects(validateBroadcaster({ ...args, fetchImpl: async () => ({ ok: true, json: async () => ({ ...valid, ...patch }) }) }));
});
test('UNKNOWN cancels and YES resolves using server-known outcome', async () => {
  const calls = []; const fetchImpl = async (url, options) => { if (url.includes('/validate')) return { ok: true, json: async () => valid }; calls.push(JSON.parse(options.body)); return { ok: true, json: async () => ({ data: [{ id: 'p' }] }) }; };
  const client = predictionClient({ token: 'token', clientId: 'client', broadcasterId: 'channel', fetchImpl });
  await client.close('p', 'UNKNOWN'); await client.close('p', 'YES', [{ id: 'yes-id', title: 'YES' }]);
  assert.equal(calls[0].status, 'CANCELED'); assert.equal(calls[0].winning_outcome_id, undefined); assert.equal(calls[1].winning_outcome_id, 'yes-id');
  assert.throws(() => client.close('p', 'NO', []));
});
test('extension verifies signature, role, expiry, channel and stable identity', () => {
  const secret = Buffer.from('demo secret'); const encode = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const sign = p => { const a = `${encode({ alg: 'HS256' })}.${encode(p)}`; return `${a}.${createHmac('sha256', secret).update(a).digest('base64url')}`; };
  const payload = { exp: 2000, channel_id: 'channel', role: 'viewer', opaque_user_id: 'Uabc' };
  assert.equal(extensionIdentity(sign(payload), secret.toString('base64'), 'channel', 1000000).viewerId, 'Uabc');
  for (const patch of [{ exp: 1 }, { channel_id: 'other' }, { role: 'external' }, { opaque_user_id: 'Aabc' }]) assert.throws(() => extensionIdentity(sign({ ...payload, ...patch }), secret.toString('base64'), 'channel', 1000000));
  assert.throws(() => extensionIdentity(sign(payload), Buffer.from('wrong').toString('base64'), 'channel', 1000000));
});

test('extension adapter derives viewer identity, deduplicates, and forbids verdicts', async () => {
  const { createService } = await import('../src/local/service.js'); const { createExtensionAdapter } = await import('../src/twitch/ebs.js');
  const { mkdtemp, rm } = await import('node:fs/promises'); const path = await import('node:path'); const os = await import('node:os');
  const dir = await mkdtemp(path.join(os.tmpdir(), 'called-ebs-')); const secret = Buffer.from('demo secret');
  const encode = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const jwt = id => { const p = `${encode({ alg: 'HS256' })}.${encode({ exp: Math.floor(Date.now()/1000)+60, channel_id: 'channel', role: 'viewer', opaque_user_id: id })}`; return `${p}.${createHmac('sha256', secret).update(p).digest('base64url')}`; };
  try {
    const service = createService(path.join(dir, 'state.json')); await service.load();
    const ebs = createExtensionAdapter({ service, channelId: 'channel', secretBase64: secret.toString('base64') });
    let out = await ebs.handle({ token: jwt('Uone'), action: 'propose', input: { question: 'Red?', rule: 'Rule', zone: { x: 0, y: 0, w: 1, h: 1 } } });
    const id = out.calls[0].id; assert.equal(out.calls[0].supporterCount, 1); assert.equal(out.calls[0].supporterIds, undefined);
    await ebs.handle({ token: jwt('Uone'), action: 'support', input: { id } });
    out = await ebs.handle({ token: jwt('Utwo'), action: 'support', input: { id } }); assert.equal(out.calls[0].supporterCount, 2);
    await assert.rejects(ebs.handle({ token: jwt('Uone'), action: 'support', input: { id, verdict: 'YES' } }));
    await assert.rejects(ebs.handle({ token: jwt('Aanonymous'), action: 'support', input: { id } }));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('OAuth state is single-use and exchanges and validates token server-side', async () => {
  const { createOAuth } = await import('../src/twitch/oauth.js'); let exchanges = 0;
  const fetchImpl = async (url, opts) => {
    if (url.endsWith('/token')) { exchanges++; assert.equal(new URLSearchParams(opts.body).get('grant_type'), 'authorization_code'); return { ok: true, json: async () => ({ access_token: 'private', refresh_token: 'refresh' }) }; }
    return { ok: true, json: async () => valid };
  };
  const oauth = createOAuth({ clientId: 'client', clientSecret: 'secret', broadcasterId: 'channel', redirectUri: 'http://127.0.0.1/callback', fetchImpl });
  const state = new URL(oauth.begin()).searchParams.get('state');
  await assert.rejects(oauth.finish({ state: 'wrong', code: 'code' }));
  assert.equal((await oauth.finish({ state, code: 'code' })).broadcasterId, 'channel');
  assert.equal(oauth.getAccessToken(), 'private'); await assert.rejects(oauth.finish({ state, code: 'code' })); assert.equal(exchanges, 1);
  oauth.clear(); assert.equal(oauth.getAccessToken(), null);
});

test('OAuth loopback callback validates once without returning tokens', async () => {
  const { startOAuthServer } = await import('../src/twitch/oauth-server.js');
  const fetchImpl = async url => url.endsWith('/token') ? { ok: true, json: async () => ({ access_token: 'secret-token', refresh_token: 'secret-refresh' }) } : { ok: true, json: async () => valid };
  const { server } = await startOAuthServer({ clientId: 'client', clientSecret: 'secret', broadcasterId: 'channel', port: 0, fetchImpl });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const redirect = await fetch(`${base}/connect`, { redirect: 'manual' }); assert.equal(redirect.status, 302);
    const state = new URL(redirect.headers.get('location')).searchParams.get('state');
    const result = await fetch(`${base}/callback?state=${state}&code=test`); assert.equal(result.status, 200); assert.doesNotMatch(await result.text(), /secret/);
    assert.equal((await fetch(`${base}/callback?state=${state}&code=test`)).status, 400);
  } finally { await new Promise(r => server.close(r)); }
});

test('OAuth refresh rotates tokens once for concurrent requests and clears on rejection', async () => {
  const { createOAuth } = await import('../src/twitch/oauth.js'); let refreshCount = 0; let fail = false;
  const fetchImpl = async (url, options) => {
    if (url.endsWith('/validate')) return { ok: true, json: async () => valid };
    const body = new URLSearchParams(options.body);
    if (body.get('grant_type') === 'authorization_code') return { ok: true, json: async () => ({ access_token: 'initial', refresh_token: 'old' }) };
    refreshCount++; assert.equal(body.get('refresh_token'), refreshCount === 1 ? 'old' : 'new');
    return fail ? { ok: false } : { ok: true, json: async () => ({ access_token: 'updated', refresh_token: 'new' }) };
  };
  const oauth = createOAuth({ clientId: 'client', clientSecret: 'secret', broadcasterId: 'channel', redirectUri: 'http://localhost/callback', fetchImpl });
  const state = new URL(oauth.begin()).searchParams.get('state'); await oauth.finish({ state, code: 'code' });
  await Promise.all([oauth.refresh(), oauth.refresh()]); assert.equal(refreshCount, 1); assert.equal(oauth.getAccessToken(), 'updated');
  fail = true; await assert.rejects(oauth.refresh()); assert.equal(oauth.getAccessToken(), null);
});

test('coordinator requires approval and confirmation and never retries uncertain calls', async () => {
  const { createPredictionCoordinator } = await import('../src/twitch/coordinator.js'); const map = new Map(); let opens = 0, closes = 0;
  const journal = { get: async id => map.get(id), compareAndSet: async (id, expected, value) => { if ((map.get(id)?.state ?? null) !== expected) return false; map.set(id, value); return true; } };
  const client = { create: async () => { opens++; return { id: 'p', outcomes: [{ id: 'y', title: 'YES' }, { id: 'n', title: 'NO' }] }; }, close: async () => { closes++; throw new Error('connection lost'); } };
  const coordinator = createPredictionCoordinator({ client, journal });
  await assert.rejects(coordinator.open({ id: 'a', status: 'proposed' }));
  await coordinator.open({ id: 'a', status: 'awaiting_suggestion', question: 'Red?' });
  await assert.rejects(coordinator.resolve({ id: 'a', status: 'suggested', finalVerdict: 'UNKNOWN' }));
  await assert.rejects(coordinator.resolve({ id: 'a', status: 'confirmed', finalVerdict: 'UNKNOWN' }));
  assert.equal(map.get('a').state, 'close_uncertain');
  await assert.rejects(coordinator.resolve({ id: 'a', status: 'confirmed', finalVerdict: 'UNKNOWN' }));
  assert.equal(opens, 1); assert.equal(closes, 1);
});


test('durable journal blocks concurrent starts and retains uncertain states after restart', async () => {
  const { createJournal } = await import('../src/twitch/journal.js'); const { mkdtemp, rm } = await import('node:fs/promises'); const path = await import('node:path'); const os = await import('node:os');
  const dir = await mkdtemp(path.join(os.tmpdir(), 'called-journal-')); const file = path.join(dir, 'journal.json');
  try { const j = createJournal(file); const outcomes = await Promise.all([j.compareAndSet('a', null, { state: 'creating' }), j.compareAndSet('a', null, { state: 'creating' })]); assert.equal(outcomes.filter(Boolean).length, 1); assert.equal((await createJournal(file).get('a')).state, 'creating'); assert.equal(await j.compareAndSet('a', null, { state: 'creating' }), false); }
  finally { await rm(dir, { recursive: true, force: true }); }
});

test('reconciliation reads Twitch status without issuing another closure', async () => {
  const { createPredictionCoordinator } = await import('../src/twitch/coordinator.js'); const map = new Map(); let closeCount = 0;
  const journal = { get: async id => map.get(id), compareAndSet: async (id, expected, value) => { if ((map.get(id)?.state ?? null) !== expected) return false; map.set(id, value); return true; } };
  const client = { create: async () => ({ id: 'p', outcomes: [{ id: 'y', title: 'YES' }, { id: 'n', title: 'NO' }] }), close: async () => { closeCount++; throw new Error('lost response'); }, get: async () => ({ id: 'p', status: 'CANCELED' }) };
  const coordinator = createPredictionCoordinator({ client, journal }); await coordinator.open({ id: 'a', status: 'awaiting_suggestion', question: 'Red?' });
  await assert.rejects(coordinator.resolve({ id: 'a', status: 'confirmed', finalVerdict: 'UNKNOWN' }));
  assert.equal((await coordinator.inspect('a')).status, 'closed'); assert.equal(map.get('a').status, 'CANCELED'); assert.equal(closeCount, 1);
});

test('workflow reads server-owned state, confirms UNKNOWN, and cancels a mocked prediction', async () => {
  const { createService } = await import('../src/local/service.js'); const { createPredictionCoordinator } = await import('../src/twitch/coordinator.js'); const { createTwitchWorkflow } = await import('../src/twitch/workflow.js');
  const { mkdtemp, rm } = await import('node:fs/promises'); const path = await import('node:path'); const os = await import('node:os'); const dir = await mkdtemp(path.join(os.tmpdir(), 'called-workflow-'));
  try {
    const service = createService(path.join(dir, 'calls.json')); await service.load(); let state = await service.dispatch('create', { question: 'Red?', rule: 'Rule', zone: { x: 0, y: 0, w: 1, h: 1 } }); const id = state.calls[0].id;
    const records = new Map(); const journal = { get: async id => records.get(id), compareAndSet: async (id, expected, value) => { if ((records.get(id)?.state ?? null) !== expected) return false; records.set(id, value); return true; } };
    let closeVerdict; const client = { create: async () => ({ id: 'p', outcomes: [{ id: 'y', title: 'YES' }, { id: 'n', title: 'NO' }] }), close: async (predictionId, verdict) => { closeVerdict = verdict; return { id: predictionId, status: 'CANCELED' }; } };
    const workflow = createTwitchWorkflow({ service, coordinator: createPredictionCoordinator({ client, journal }) });
    await assert.rejects(workflow.confirm(id)); await workflow.approve(id); await service.dispatch('observe', { id });
    const result = await workflow.confirm(id); assert.equal(closeVerdict, 'UNKNOWN'); assert.equal(result.prediction.status, 'CANCELED'); assert.equal(result.state.receipts[0].canceled, true);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('local votes deduplicate identities and never determine a verdict', async () => {
  const { createService } = await import('../src/local/service.js'); const { mkdtemp, rm } = await import('node:fs/promises'); const path = await import('node:path'); const os = await import('node:os'); const dir = await mkdtemp(path.join(os.tmpdir(), 'called-votes-'));
  try {
    const service = createService(path.join(dir, 'calls.json')); await service.load(); let state = await service.dispatch('create', { question: 'Red?', rule: 'Rule', zone: { x: 0, y: 0, w: 1, h: 1 } }); const id = state.calls[0].id;
    await assert.rejects(service.dispatch('vote', { id, viewerId: 'a', choice: 'YES' })); await service.dispatch('approve', { id });
    await service.dispatch('vote', { id, viewerId: 'a', choice: 'YES' }); await service.dispatch('vote', { id, viewerId: 'a', choice: 'NO' }); state = await service.dispatch('vote', { id, viewerId: 'b', choice: 'NO' });
    assert.deepEqual(state.calls[0].localVotes.map(v => v.choice), ['YES', 'NO']); assert.equal(state.calls[0].finalVerdict, undefined);
    state = await service.dispatch('observe', { id }); assert.equal(state.calls[0].suggestion.verdict, 'UNKNOWN');
    await assert.rejects(service.dispatch('vote', { id, viewerId: 'c', choice: 'YES' }));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('configuration check reports missing fields and never prints tokens', async () => {
  const { checkConfiguration } = await import('../src/twitch/check.js');
  const missing = await checkConfiguration({}); assert.equal(missing.ok, false); assert.match(missing.message, /TWITCH_CLIENT_ID/);
  const env = { TWITCH_CLIENT_ID: 'client', TWITCH_BROADCASTER_ID: 'channel', TWITCH_USER_ACCESS_TOKEN: 'private-token' };
  const good = await checkConfiguration(env, async () => ({ ok: true, json: async () => valid })); assert.equal(good.ok, true); assert.doesNotMatch(good.message, /private-token/);
  const bad = await checkConfiguration(env, async () => { throw new Error('private-token'); }); assert.equal(bad.ok, false); assert.doesNotMatch(bad.message, /private-token/);
});

test('Twitch route requires a secret and only accepts call id and explicit action', async () => {
  const { startServer } = await import('../src/local/server.js'); const { mkdtemp, rm } = await import('node:fs/promises'); const os = await import('node:os'); const path = await import('node:path'); const dir = await mkdtemp(path.join(os.tmpdir(), 'called-route-')); let invoked = 0;
  const key = 'a'.repeat(32); const server = await startServer({ port: 0, file: path.join(dir, 'calls.json'), operatorKey: key, twitchFactory: () => ({ approve: async id => { invoked++; return { id }; } }) });
  const url = `http://127.0.0.1:${server.address().port}/api/twitch`; const post = (keyValue, body) => fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${keyValue}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try { assert.equal((await post('wrong', { action: 'approve', id: 'one' })).status, 401); assert.equal((await post(key, { action: 'approve', id: 'one', verdict: 'YES' })).status, 400); assert.equal((await post(key, { action: 'approve', id: 'one' })).status, 200); assert.equal(invoked, 1); }
  finally { await new Promise(r => server.close(r)); await rm(dir, { recursive: true, force: true }); }
});

test('Twitch mode rejects local unauthenticated approval', async () => {
  const { startServer } = await import('../src/local/server.js'); const { mkdtemp, rm } = await import('node:fs/promises'); const os = await import('node:os'); const path = await import('node:path'); const dir = await mkdtemp(path.join(os.tmpdir(), 'called-gate-'));
  const server = await startServer({ port: 0, file: path.join(dir, 'state.json'), operatorKey: 'a'.repeat(32), twitchFactory: () => ({}) });
  try { const response = await fetch(`http://127.0.0.1:${server.address().port}/api/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'approve', input: { id: 'x' } }) }); assert.equal(response.status, 403); }
  finally { await new Promise(r => server.close(r)); await rm(dir, { recursive: true, force: true }); }
});

test('loopback extension route authenticates a JWT and never trusts viewerId from its body', async () => {
  const { startServer } = await import('../src/local/server.js'); const { createExtensionAdapter } = await import('../src/twitch/ebs.js');
  const { mkdtemp, rm } = await import('node:fs/promises'); const os = await import('node:os'); const path = await import('node:path');
  const dir = await mkdtemp(path.join(os.tmpdir(), 'called-extension-route-')); const secret = Buffer.from('extension route secret');
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const jwt = viewer => { const signed = `${encode({ alg: 'HS256' })}.${encode({ exp: Math.floor(Date.now() / 1000) + 60, channel_id: 'channel', role: 'viewer', opaque_user_id: viewer })}`; return `${signed}.${createHmac('sha256', secret).update(signed).digest('base64url')}`; };
  const server = await startServer({ port: 0, file: path.join(dir, 'calls.json'), extensionFactory: service => createExtensionAdapter({ service, channelId: 'channel', secretBase64: secret.toString('base64') }) });
  const endpoint = `http://127.0.0.1:${server.address().port}/api/extension`;
  const post = (token, body) => fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  try {
    assert.equal((await post('not-a-jwt', { action: 'propose', input: {} })).status, 401);
    assert.equal((await post(jwt('Uone'), { action: 'propose', input: { question: 'Red?', rule: 'Rule', zone: { x: 0, y: 0, w: 1, h: 1 }, viewerId: 'Uspoofed' } })).status, 401);
    const created = await post(jwt('Uone'), { action: 'propose', input: { question: 'Red?', rule: 'Rule', zone: { x: 0, y: 0, w: 1, h: 1 } } }); assert.equal(created.status, 200);
    const id = (await created.json()).calls[0].id;
    const supported = await post(jwt('Utwo'), { action: 'support', input: { id } }); const state = await supported.json(); assert.equal(state.calls[0].supporterCount, 2); assert.equal(state.calls[0].supporterIds, undefined);
  } finally { await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); }
});
