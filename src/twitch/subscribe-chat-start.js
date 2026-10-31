import { eventSubSubscription, subscribeToChat } from './eventsub.js';

const { TWITCH_APP_ACCESS_TOKEN: appToken, TWITCH_CLIENT_ID: clientId, TWITCH_BROADCASTER_ID: broadcasterId, TWITCH_BOT_USER_ID: botUserId, TWITCH_EVENTSUB_CALLBACK: callback, TWITCH_EVENTSUB_SECRET: secret } = process.env;
const subscription = eventSubSubscription({ broadcasterId, botUserId, callback, secret });
const created = await subscribeToChat({ appToken, clientId, subscription });
// Deliberately exclude transport.secret and authorization headers from output.
console.log(JSON.stringify({ id: created.id, status: created.status, type: created.type, condition: created.condition, transport: created.transport?.method }, null, 2));
