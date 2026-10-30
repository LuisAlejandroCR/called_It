// Internal orchestration; caller must authenticate the streamer before invoking.
// The coordinator receives calls read from the server, never verdicts from the request.
export function createTwitchWorkflow({ service, coordinator }) {
  if (!service || !coordinator) throw new Error('Workflow dependencies required');
  const find = (state, id) => { const call = state.calls.find(c => c.id === id); if (!call) throw new Error('Call not found'); return call; };
  return {
    async approve(id) {
      const state = await service.dispatch('approve', { id });
      const call = find(state, id);
      // On failure the local call stays approved; the journal decides whether a Twitch operation needs reconciliation.
      const prediction = await coordinator.open(call);
      return { state, prediction };
    },
    async confirm(id) {
      // Explicit user action triggers the transition; verdict is read from stored suggestion.
      const state = await service.dispatch('confirm', { id });
      const call = find(state, id);
      const prediction = await coordinator.resolve(call);
      return { state, prediction };
    },
    inspect: id => coordinator.inspect(id),
  };
}
