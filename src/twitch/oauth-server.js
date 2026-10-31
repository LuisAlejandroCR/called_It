import http from 'node:http';
import { createOAuth } from './oauth.js';

// A separate loopback-only authorization process. Does not expose tokens or perform Twitch actions.
export async function startOAuthServer({ clientId, clientSecret, broadcasterId, port = 4180, fetchImpl = fetch } = {}) {
  const redirectUri = `http://localhost:${port}/callback`;
  const oauth = createOAuth({ clientId, clientSecret, broadcasterId, redirectUri, fetchImpl });
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    const url = new URL(req.url, redirectUri);
    if (req.method !== 'GET') { res.writeHead(405); return res.end(); }
    if (url.pathname === '/connect') { res.writeHead(302, { Location: oauth.begin() }); return res.end(); }
    if (url.pathname === '/callback') {
      try {
        await oauth.finish({ state: url.searchParams.get('state'), code: url.searchParams.get('code') });
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Twitch authorization validated. You may close this window.');
      } catch { res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Twitch authorization failed or expired. Start again.'); }
    }
    res.writeHead(404); res.end();
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { server, oauth };
}
