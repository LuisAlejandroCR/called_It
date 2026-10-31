import { createHmac, timingSafeEqual } from 'node:crypto';
// Twitch Extension JWTs: verify before accepting identity or channel.
export function extensionIdentity(token, secretBase64, channelId, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 4096 || typeof secretBase64 !== 'string' || !channelId) throw new Error('Invalid extension token');
  const parts = token.split('.'); if (parts.length !== 3 || parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p))) throw new Error('Invalid extension token');
  let header, payload; try { header = JSON.parse(Buffer.from(parts[0], 'base64url')); payload = JSON.parse(Buffer.from(parts[1], 'base64url')); } catch { throw new Error('Invalid extension token'); }
  const secret = Buffer.from(secretBase64, 'base64'); if (!secret.length || header.alg !== 'HS256') throw new Error('Invalid extension token');
  const actual = Buffer.from(parts[2], 'base64url'); const expected = createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected) || !Number.isFinite(payload.exp) || payload.exp <= now / 1000 || payload.channel_id !== channelId || payload.role !== 'viewer' || typeof payload.opaque_user_id !== 'string' || !/^U[A-Za-z0-9]+$/.test(payload.opaque_user_id)) throw new Error('Invalid extension identity');
  return { viewerId: payload.opaque_user_id, channelId: payload.channel_id };
}
