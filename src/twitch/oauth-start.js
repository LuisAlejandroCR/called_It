import { startOAuthServer } from './oauth-server.js';
const { server } = await startOAuthServer({ clientId: process.env.TWITCH_CLIENT_ID, clientSecret: process.env.TWITCH_CLIENT_SECRET, broadcasterId: process.env.TWITCH_BROADCASTER_ID });
console.log(`Open http://localhost:${server.address().port}/connect to authorize. Credentials remain in memory until this process exits.`);
