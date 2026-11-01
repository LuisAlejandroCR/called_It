import { createHmac, timingSafeEqual } from 'node:crypto';
import { parseCallCommand, pseudonymousViewerId } from './anticipations.js';

const header = (headers, name) => headers?.[name] ?? headers?.[name.toLowerCase()];

export function verifyEventSubSignature({ headers, rawBody, secret, now = Date.now(), maxAgeMs = 10 * 60 * 1000, maxFutureSkewMs = 60 * 1000 }) {
  const id = header(headers, 'twitch-eventsub-message-id');
  const timestamp = header(headers, 'twitch-eventsub-message-timestamp');
  const signature = header(headers, 'twitch-eventsub-message-signature');
  const sentAt = Date.parse(timestamp);
  if (typeof id !== 'string' || typeof timestamp !== 'string' || typeof signature !== 'string' || !Buffer.isBuffer(rawBody) || typeof secret !== 'string' || secret.length < 10 || !/^sha256=[a-f0-9]{64}$/i.test(signature) || !Number.isFinite(sentAt) || sentAt < now - maxAgeMs || sentAt > now + maxFutureSkewMs) return false;
  const expected = createHmac('sha256', secret).update(id).update(timestamp).update(rawBody).digest('hex');
  const provided = Buffer.from(signature.slice(7), 'hex'); const actual = Buffer.from(expected, 'hex');
  return provided.length === actual.length && timingSafeEqual(provided, actual);
}

// This adapter receives an already verified channel.chat.message notification.
// It intentionally ignores all non-command chat content.
export async function ingestChatMessage({ service, eventId, event, expectedChannelId }) {
  if (!service || !event || typeof event !== 'object') throw new Error('Invalid EventSub event');
  const text = parseCallCommand(event.message?.text);
  if (!text) return { ignored: true };
  if (typeof event.broadcaster_user_id !== 'string' || typeof event.chatter_user_id !== 'string' || typeof eventId !== 'string' || (expectedChannelId && event.broadcaster_user_id !== expectedChannelId)) throw new Error('Invalid chat message event');
  return service.propose({ channelId: event.broadcaster_user_id, viewerId: pseudonymousViewerId(event.broadcaster_user_id, event.chatter_user_id), text, eventId, receivedAt: event.message?.sent_at ?? new Date().toISOString() });
}

export function eventSubSubscription({ broadcasterId, botUserId, callback, secret }) {
  if (![broadcasterId, botUserId, callback, secret].every(value => typeof value === 'string' && value)) throw new Error('EventSub configuration incomplete');
  if (!/^https:\/\//.test(callback) || secret.length < 10 || secret.length > 100) throw new Error('Invalid EventSub webhook configuration');
  return { type: 'channel.chat.message', version: '1', condition: { broadcaster_user_id: broadcasterId, user_id: botUserId }, transport: { method: 'webhook', callback, secret } };
}

// Webhook subscriptions use an app token. The broadcaster/bot must previously
// have authorized the client with the chat scopes Twitch requires.
export async function subscribeToChat({ appToken, clientId, subscription, fetchImpl = fetch }) {
  if (![appToken, clientId].every(value => typeof value === 'string' && value) || !subscription) throw new Error('EventSub credentials are incomplete');
  const response = await fetchImpl('https://api.twitch.tv/helix/eventsub/subscriptions', { method: 'POST', headers: { Authorization: `Bearer ${appToken}`, 'Client-Id': clientId, 'Content-Type': 'application/json' }, body: JSON.stringify(subscription) });
  if (!response.ok) throw new Error(`EventSub subscription failed (${response.status})`);
  const payload = await response.json(); if (!Array.isArray(payload.data) || !payload.data[0]?.id) throw new Error('Invalid EventSub subscription response');
  return payload.data[0];
}
