// Coordinator: the caller supplies a durable journal and a confirmed server-side call.
// Never automatically retry an operation whose response could have been lost.
export function createPredictionCoordinator({ client, journal }) {
  if (!client || !journal) throw new Error('Coordinator dependencies required');
  async function open(call) {
    if (!call || call.status !== 'awaiting_suggestion' || !call.id) throw new Error('Streamer approval required');
    if (!await journal.compareAndSet(call.id, null, { state: 'creating' })) throw new Error('Prediction already started or requires reconciliation');
    let prediction;
    try { prediction = await client.create(call.question); }
    catch { await journal.compareAndSet(call.id, 'creating', { state: 'create_uncertain' }); throw new Error('Prediction creation requires reconciliation'); }
    if (!prediction?.id || !Array.isArray(prediction.outcomes) || !['YES', 'NO'].every(name => prediction.outcomes.filter(o => o.title === name && typeof o.id === 'string' && o.id).length === 1)) {
      await journal.compareAndSet(call.id, 'creating', { state: 'create_uncertain' }); throw new Error('Prediction response requires reconciliation');
    }
    const record = { state: 'open', id: prediction.id, outcomes: prediction.outcomes };
    await journal.compareAndSet(call.id, 'creating', record); return record;
  }
  async function resolve(call) {
    if (!call || call.status !== 'confirmed' || !['YES','NO','UNKNOWN'].includes(call.finalVerdict)) throw new Error('Streamer confirmation required');
    const record = await journal.get(call.id);
    if (!record || record.state !== 'open') throw new Error('Prediction not open or requires reconciliation');
    if (!await journal.compareAndSet(call.id, 'open', { ...record, state: 'closing', intendedVerdict: call.finalVerdict })) throw new Error('Prediction is already being closed');
    let result;
    try { result = await client.close(record.id, call.finalVerdict, record.outcomes); }
    catch { await journal.compareAndSet(call.id, 'closing', { ...record, state: 'close_uncertain', intendedVerdict: call.finalVerdict }); throw new Error('Prediction closure requires reconciliation'); }
    const expected = call.finalVerdict === 'UNKNOWN' ? 'CANCELED' : 'RESOLVED';
    if (result?.id !== record.id || result.status !== expected || (expected === 'RESOLVED' && result.winning_outcome_id !== record.outcomes.find(o => o.title === call.finalVerdict)?.id)) {
      await journal.compareAndSet(call.id, 'closing', { ...record, state: 'close_uncertain', intendedVerdict: call.finalVerdict }); throw new Error('Prediction response requires reconciliation');
    }
    const next = { ...record, state: 'closed', status: expected }; await journal.compareAndSet(call.id, 'closing', next); return next;
  }
  async function inspect(callId) {
    const record = await journal.get(callId);
    if (!record || !['closing', 'close_uncertain'].includes(record.state) || !record.id || !record.intendedVerdict) throw new Error('No closable operation to inspect');
    const remote = await client.get(record.id);
    const expected = record.intendedVerdict === 'UNKNOWN' ? 'CANCELED' : 'RESOLVED';
    const winning = record.outcomes.find(o => o.title === record.intendedVerdict)?.id;
    if (remote.status !== expected || (expected === 'RESOLVED' && remote.winning_outcome_id !== winning)) return { status: 'unresolved', remoteStatus: remote.status };
    if (!await journal.compareAndSet(callId, record.state, { ...record, state: 'closed', status: expected })) throw new Error('Operation changed during inspection');
    return { status: 'closed', remoteStatus: remote.status };
  }
  return { open, resolve, inspect };
}


