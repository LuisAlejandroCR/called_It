import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { evaluateRedSample } from './verifier.js';
import { approveProposal, rejectProposal, attachSuggestion, confirmSuggestion, rejectSuggestion, toReceipt, validateZone } from '../../packages/domain/core.js';

const fail = message => { throw new Error(message); };
const text = (x, max = 500) => typeof x === 'string' && x.trim().length > 0 && x.length <= max;
export function createService(file, { verify = evaluateRedSample } = {}) {
  let state = { calls: [], receipts: [] };
  let queue = Promise.resolve();
  async function load() { try { state = JSON.parse(await readFile(file, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; } }
  async function save(next) { await mkdir(path.dirname(file), { recursive: true }); const tmp = `${file}.${randomUUID()}.tmp`; await writeFile(tmp, JSON.stringify(next, null, 2), { mode: 0o600, flag: 'wx' }); await rename(tmp, file); }
  const run = task => { const result = queue.then(task); queue = result.catch(() => {}); return result; };
  return {
    load,
    snapshot: () => structuredClone(state),
    dispatch(action, input = {}) { return run(async () => {
      const next = structuredClone(state);
      if (action === 'create' || action === 'extension-create') {
        if (!text(input.question) || !text(input.rule) || !validateZone(input.zone) || (action === 'extension-create' && !text(input.viewerId, 100))) fail('Invalid proposal');
        next.calls.push({ id: randomUUID(), question: input.question.trim(), rule: input.rule.trim(), zone: input.zone, supporterIds: action === 'extension-create' ? [input.viewerId] : [], status: 'proposed', eventTime: '' });
      } else {
        const index = next.calls.findIndex(c => c.id === input.id);
        if (index < 0) fail('Call not found');
        let call = next.calls[index];
        if (action === 'support') {
          if (call.status !== 'proposed' || !text(input.viewerId, 100)) fail('Invalid support');
          if (!call.supporterIds.includes(input.viewerId)) call.supporterIds.push(input.viewerId);
        } else if (action === 'vote') {
          if (call.status !== 'awaiting_suggestion' || !text(input.viewerId, 100) || !['YES', 'NO'].includes(input.choice)) fail('Invalid local vote');
          const votes = Array.isArray(call.localVotes) ? call.localVotes : [];
          if (!votes.some(v => v.viewerId === input.viewerId)) votes.push({ viewerId: input.viewerId, choice: input.choice });
          call.localVotes = votes;
        } else if (action === 'approve') call = approveProposal(call);
        else if (action === 'reject-proposal') call = rejectProposal(call);
        else if (action === 'observe') {
          const sample = input.sample;
          let decision = { verdict: 'UNKNOWN', reason: sample ? 'The call does not use the supported red-pixel rule.' : 'No camera observation supplied.' };
          if (sample && call.rule === 'At least 20% of pixels in the selected zone are strongly red.') {
            try { decision = verify(sample); if (!decision || !['YES', 'UNKNOWN'].includes(decision.verdict) || typeof decision.reason !== 'string') throw new Error('invalid verifier response'); }
            catch { decision = { verdict: 'UNKNOWN', reason: 'Verifier failed.' }; }
          }
          const eventTime = sample && Number.isFinite(Date.parse(sample.capturedAt)) ? sample.capturedAt : new Date().toISOString();
          const evidenceHash = sample && /^[a-f0-9]{64}$/.test(sample.hash ?? '') ? sample.hash : createHash('sha256').update(`offline:${call.id}:${eventTime}`).digest('hex');
          call = attachSuggestion({ ...call, eventTime }, { ...decision, source: sample ? 'camera-metrics' : 'offline', unclearCamera: decision.verdict === 'UNKNOWN', evidenceHash });
        } else if (action === 'confirm') {
          call = confirmSuggestion(call);
          next.receipts.unshift(toReceipt(call));
        } else if (action === 'reject-suggestion') call = rejectSuggestion(call);
        else fail('Unknown action');
        next.calls[index] = call;
      }
      await save(next); state = next; return structuredClone(state);
    }); }
  };
}






