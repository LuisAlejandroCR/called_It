import path from 'node:path';
import { startServer } from '../local/server.js';
import { predictionClient } from './helix.js';
import { createJournal } from './journal.js';
import { createPredictionCoordinator } from './coordinator.js';
import { createTwitchWorkflow } from './workflow.js';
import { createExtensionAdapter } from './ebs.js';

const { TWITCH_CLIENT_ID: clientId, TWITCH_BROADCASTER_ID: broadcasterId, TWITCH_USER_ACCESS_TOKEN: token, TWITCH_OPERATOR_KEY: operatorKey, TWITCH_EXTENSION_SECRET_BASE64: extensionSecret } = process.env;
if (!clientId || !broadcasterId || !token || !operatorKey) throw new Error('Twitch configuration incomplete');
const client = predictionClient({ clientId, broadcasterId, token });
const journal = createJournal(path.resolve('data/twitch-journal.json'));
await startServer({
  operatorKey,
  twitchFactory: service => createTwitchWorkflow({ service, coordinator: createPredictionCoordinator({ client, journal }) }),
  extensionFactory: extensionSecret ? service => createExtensionAdapter({ service, channelId: broadcasterId, secretBase64: extensionSecret }) : undefined,
});
console.log(`Local Twitch mode running on 127.0.0.1:4174.${extensionSecret ? ' Extension JWT harness enabled.' : ''} Do not run another server with the same data files.`);
