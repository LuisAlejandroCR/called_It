import { validateBroadcaster } from './helix.js';

export async function checkConfiguration(env, fetchImpl = fetch) {
  const required = ['TWITCH_CLIENT_ID', 'TWITCH_BROADCASTER_ID', 'TWITCH_USER_ACCESS_TOKEN'];
  const missing = required.filter(name => !env[name]);
  if (missing.length) return { ok: false, message: `Missing environment variables: ${missing.join(', ')}` };
  try {
    const info = await validateBroadcaster({ clientId: env.TWITCH_CLIENT_ID, broadcasterId: env.TWITCH_BROADCASTER_ID, token: env.TWITCH_USER_ACCESS_TOKEN, fetchImpl });
    return { ok: true, message: `Broadcaster token validated with required Predictions scope; expires in ${info.expiresIn} seconds.` };
  } catch { return { ok: false, message: 'Token validation failed: check connectivity, application ID, broadcaster ID, scope and expiry.' }; }
}
