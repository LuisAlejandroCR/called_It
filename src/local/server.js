import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createService } from './service.js';
import { timingSafeEqual } from 'node:crypto';

export async function startServer({ port = 4174, host = process.env.CALLED_IT_HOST || '127.0.0.1', file = path.resolve('data/local.json'), twitchFactory, extensionFactory, operatorKey } = {}) {
  const service = createService(file);
  await service.load();
  const twitch = twitchFactory ? twitchFactory(service) : null;
  const extension = extensionFactory ? extensionFactory(service) : null;
  if (twitch && (typeof operatorKey !== "string" || operatorKey.length < 32 || host !== "127.0.0.1")) throw new Error("Twitch mode requires loopback and an operator key of at least 32 characters");
  // This is an EBS-shaped local harness, not a public Extension deployment.
  // Keep it loopback-only until TLS, production CORS, and rate limits exist.
  if (extension && host !== '127.0.0.1') throw new Error('Extension harness requires loopback');
  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    try {
      const origin = req.headers.origin;
      const allowedOrigin = origin && /^http:\/\/(localhost|127\.0\.0\.1):(5173|8081)$/.test(origin);
      if (origin && !allowedOrigin) { res.writeHead(403); return res.end('{}'); }
      if (allowedOrigin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); }
      if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
      if (req.url === '/api/extension' && req.method === 'POST') {
        if (!extension) { res.writeHead(404); return res.end('{}'); }
        const header = req.headers.authorization || '';
        if (!header.startsWith('Bearer ') || header.length < 8) { res.writeHead(401); return res.end('{}'); }
        let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 8192) throw new Error('Request too large'); }
        let input;
        try { input = JSON.parse(body); } catch { res.writeHead(400); return res.end('{}'); }
        if (!input || !['propose', 'support', 'vote'].includes(input.action) || !input.input || typeof input.input !== 'object' || Array.isArray(input.input) || Object.keys(input).some(key => !['action', 'input'].includes(key))) { res.writeHead(400); return res.end('{}'); }
        try {
          return res.end(JSON.stringify(await extension.handle({ token: header.slice(7), action: input.action, input: input.input })));
        } catch { res.writeHead(401); return res.end('{}'); }
      }
      if (req.url === '/api/twitch' && req.method === 'POST') {
        if (!twitch) { res.writeHead(404); return res.end('{}'); }
        const header = req.headers.authorization || '';
        const supplied = Buffer.from(header.startsWith('Bearer ') ? header.slice(7) : '');
        const expected = Buffer.from(operatorKey);
        if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) { res.writeHead(401); return res.end('{}'); }
        let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 1024) throw new Error('Request too large'); }
        const input = JSON.parse(body);
        if (!input || !['approve','confirm','inspect'].includes(input.action) || typeof input.id !== 'string' || Object.keys(input).some(k => !['action','id'].includes(k))) throw new Error('Invalid Twitch action');
        const result = await twitch[input.action](input.id);
        return res.end(JSON.stringify(result));
      }
      if (req.url === '/api/state' && req.method === 'GET') return res.end(JSON.stringify({ ...service.snapshot(), mode: twitch ? 'twitch' : 'local' }));
      if (req.url !== '/api/action' || req.method !== 'POST') { res.writeHead(404); return res.end('{}'); }
      // Browser requests must be same-origin through the dev server proxy.
      let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 8192) throw new Error('Request too large'); }
      const parsed = JSON.parse(body);
      if (!parsed || typeof parsed.action !== 'string' || !parsed.input || typeof parsed.input !== 'object') throw new Error('Invalid request');
      const allowed = { create: ['question','rule','zone'], support: ['id','viewerId'], vote: ['id','viewerId','choice'], approve: ['id'], 'reject-proposal': ['id'], observe: ['id','sample'], confirm: ['id'], 'reject-suggestion': ['id'] };
      if (!allowed[parsed.action] || Object.keys(parsed.input).some(k => !allowed[parsed.action].includes(k))) throw new Error('Unexpected input');
      if (twitch && ['approve','confirm'].includes(parsed.action)) { res.writeHead(403); return res.end(JSON.stringify({ error: 'Use authenticated Twitch route' })); }
      if (parsed.action === 'observe' && parsed.input.sample !== undefined) {
        const sample = parsed.input.sample;
        if (!sample || typeof sample !== 'object' || Array.isArray(sample) || Object.keys(sample).some(k => !['kind','count','red','meanLight','hash','capturedAt'].includes(k))) throw new Error('Invalid sample');
      }
      res.end(JSON.stringify(await service.dispatch(parsed.action, parsed.input)));
    } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: e.message })); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
  return server;
}









