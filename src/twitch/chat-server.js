import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { createAnticipationService } from './anticipations.js';
import { ingestChatMessage, verifyEventSubSignature } from './eventsub.js';

const equalBearer = (value, expected) => {
  const token = typeof value === 'string' && value.startsWith('Bearer ') ? value.slice(7) : '';
  const left = Buffer.from(token); const right = Buffer.from(expected ?? '');
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
};
const read = async (request, limit = 16_384) => { const chunks = []; let size = 0; for await (const chunk of request) { size += chunk.length; if (size > limit) throw new Error('Request too large'); chunks.push(chunk); } return Buffer.concat(chunks); };

// Intended for a TLS reverse proxy in production. It is deliberately separate
// from the camera demo so no unauthenticated EventSub payload can alter it.
export async function startChatServer({ port = 4181, host = '127.0.0.1', file, eventSubSecret, operatorKey, channelId, operator = { id: 'local-operator', role: 'broadcaster' }, now = () => Date.now() } = {}) {
  if (!file || typeof eventSubSecret !== 'string' || eventSubSecret.length < 10 || typeof operatorKey !== 'string' || operatorKey.length < 32 || typeof channelId !== 'string' || !channelId || !operator || !['broadcaster', 'moderator'].includes(operator.role) || typeof operator.id !== 'string' || !operator.id) throw new Error('Chat server configuration incomplete');
  const service = createAnticipationService(file); await service.load();
  const server = http.createServer(async (request, response) => {
    try {
      if (request.url === '/eventsub' && request.method === 'POST') {
        const rawBody = await read(request);
        if (!verifyEventSubSignature({ headers: request.headers, rawBody, secret: eventSubSecret, now: now() })) { response.writeHead(403); return response.end(); }
        const body = JSON.parse(rawBody.toString('utf8')); const type = request.headers['twitch-eventsub-message-type'];
        if (type === 'webhook_callback_verification' && typeof body.challenge === 'string') { response.writeHead(200, { 'Content-Type': 'text/plain' }); return response.end(body.challenge); }
        if (type === 'revocation') {
          if (body.subscription?.type !== 'channel.chat.message' || body.subscription?.condition?.broadcaster_user_id !== channelId || typeof body.subscription?.id !== 'string' || typeof body.subscription?.status !== 'string') { response.writeHead(400); return response.end(); }
          await service.recordRevocation({ eventId: request.headers['twitch-eventsub-message-id'], subscriptionId: body.subscription.id, channelId, status: body.subscription.status }); response.writeHead(204); return response.end();
        }
        if (type !== 'notification' || body.subscription?.type !== 'channel.chat.message' || body.subscription?.condition?.broadcaster_user_id !== channelId || body.event?.broadcaster_user_id !== channelId) { response.writeHead(400); return response.end(); }
        await ingestChatMessage({ service, eventId: request.headers['twitch-eventsub-message-id'], event: body.event, expectedChannelId: channelId }); response.writeHead(204); return response.end();
      }
      if (request.url === '/api/anticipations' && request.method === 'GET') {
        const state = service.snapshot();
        // Overlay/readers need call text and status, not proposal authors or replay IDs.
        response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); return response.end(JSON.stringify({ proposals: state.proposals.map(({ authorId, ...call }) => call), receipts: state.receipts }));
      }
      if (request.url === '/api/anticipations/action' && request.method === 'POST') {
        if (!equalBearer(request.headers.authorization, operatorKey)) { response.writeHead(401); return response.end(); }
        const body = JSON.parse((await read(request, 4096)).toString('utf8'));
        if (!body || typeof body.id !== 'string' || !['accept', 'reject', 'open', 'close', 'resolve'].includes(body.action) || Object.keys(body).some(key => !['id', 'action', 'referenceTime'].includes(key))) { response.writeHead(400); return response.end(); }
        const value = await service.transition({ id: body.id, action: body.action, actor: operator, referenceTime: body.referenceTime }); response.writeHead(200, { 'Content-Type': 'application/json' }); return response.end(JSON.stringify(value));
      }
      response.writeHead(404); response.end();
    } catch { response.writeHead(400); response.end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
  return server;
}
