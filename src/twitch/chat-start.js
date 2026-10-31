import path from 'node:path';
import { startChatServer } from './chat-server.js';

const { TWITCH_EVENTSUB_SECRET: eventSubSecret, TWITCH_OPERATOR_KEY: operatorKey, TWITCH_OPERATOR_ID: operatorId, TWITCH_OPERATOR_ROLE: operatorRole = 'broadcaster' } = process.env;
await startChatServer({ file: path.resolve('data/anticipations.json'), eventSubSecret, operatorKey, operator: { id: operatorId || 'local-operator', role: operatorRole } });
console.log('Called It chat adapter listening on 127.0.0.1:4181. It requires a TLS reverse proxy before Twitch can call it.');
