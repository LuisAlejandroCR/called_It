import { randomBytes } from 'node:crypto';
import { validateBroadcaster } from './helix.js';

// Server-only, per-instance state. A hosting layer must bind sessions and protect the callback.
export function createOAuth({ clientId, clientSecret, broadcasterId, redirectUri, fetchImpl = fetch, now = Date.now }) {
  if (!clientId || !clientSecret || !broadcasterId || !redirectUri) throw new Error('OAuth configuration incomplete');
  const pending = new Map(); let credentials = null;
  function begin() {
    const state = randomBytes(32).toString('base64url'); pending.set(state, now() + 300000);
    const url = new URL('https://id.twitch.tv/oauth2/authorize');
    for (const [key, value] of Object.entries({ response_type: 'code', client_id: clientId, redirect_uri: redirectUri, scope: 'channel:manage:predictions', state })) url.searchParams.set(key, value);
    return url.toString();
  }
  async function finish({ state, code }) {
    if (typeof state !== 'string' || typeof code !== 'string' || !code || code.length > 2048) throw new Error('Invalid OAuth callback');
    const expiry = pending.get(state); pending.delete(state);
    if (!expiry || expiry <= now()) throw new Error('Invalid or expired OAuth state');
    const params = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, grant_type: 'authorization_code', redirect_uri: redirectUri });
    const response = await fetchImpl('https://id.twitch.tv/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
    if (!response.ok) throw new Error('OAuth token exchange failed');
    const tokens = await response.json();
    if (typeof tokens.access_token !== 'string' || typeof tokens.refresh_token !== 'string') throw new Error('Invalid OAuth token response');
    const identity = await validateBroadcaster({ token: tokens.access_token, clientId, broadcasterId, fetchImpl });
    credentials = { accessToken: tokens.access_token, refreshToken: tokens.refresh_token };
    return identity;
  }
  let refreshing = null;
  async function refresh() {
    if (refreshing) return refreshing;
    if (!credentials) throw new Error('Not authorized');
    const previous = credentials;
    refreshing = (async () => {
      try {
        const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token', refresh_token: previous.refreshToken });
        const response = await fetchImpl('https://id.twitch.tv/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
        if (!response.ok) throw new Error('Token refresh failed');
        const tokens = await response.json();
        if (typeof tokens.access_token !== 'string' || typeof tokens.refresh_token !== 'string') throw new Error('Invalid refresh response');
        await validateBroadcaster({ token: tokens.access_token, clientId, broadcasterId, fetchImpl });
        if (credentials !== previous) throw new Error('Authorization changed during refresh');
        credentials = { accessToken: tokens.access_token, refreshToken: tokens.refresh_token };
        return true;
      } catch (error) { if (credentials === previous) credentials = null; throw error; }
      finally { refreshing = null; }
    })();
    return refreshing;
  }
  return { begin, finish, refresh, getAccessToken: () => credentials?.accessToken ?? null, clear: () => { credentials = null; pending.clear(); } };
}


