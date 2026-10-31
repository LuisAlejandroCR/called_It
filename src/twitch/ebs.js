import { extensionIdentity } from './extension.js';

// Transport-neutral EBS adapter: only an already authenticated viewer can propose/support.
// The hosting layer must enforce TLS, CORS for the actual extension, body limits, and rate limits.
export function createExtensionAdapter({ service, channelId, secretBase64 }) {
  if (!service || !channelId || !secretBase64) throw new Error('Extension configuration required');
  return {
    async handle({ token, action, input }) {
      const { viewerId } = extensionIdentity(token, secretBase64, channelId);
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid request');
      const keys = action === 'propose' ? ['question', 'rule', 'zone'] : action === 'support' ? ['id'] : action === 'vote' ? ['id', 'choice'] : [];
      if (!keys.length || Object.keys(input).some(key => !keys.includes(key))) throw new Error('Invalid request');
      const state = await service.dispatch(action === 'propose' ? 'extension-create' : action, { ...input, viewerId });
      // Do not expose other viewers' identifiers to the extension.
      return { calls: state.calls.map(({ supporterIds, localVotes = [], ...call }) => ({ ...call, supporterCount: new Set(supporterIds).size, localVoteCount: { YES: localVotes.filter(v => v.choice === 'YES').length, NO: localVotes.filter(v => v.choice === 'NO').length } })) };
    }
  };
}

