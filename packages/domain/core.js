const requireState = (condition, message) => { if (!condition) throw new Error(message); };
export const supporterCount = c => new Set(c.supporterIds).size;
export const isPending = c => ['proposed', 'awaiting_suggestion', 'suggested'].includes(c.status);
export function approveProposal(c) { requireState(c.status === 'proposed', 'Only proposed calls can be approved'); return { ...c, status: 'awaiting_suggestion' }; }
export function rejectProposal(c) { requireState(c.status === 'proposed', 'Only proposed calls can be rejected'); return { ...c, status: 'proposal_rejected' }; }
export function attachSuggestion(c, suggestion) { requireState(c.status === 'awaiting_suggestion', 'Call is not awaiting a suggestion'); requireState(suggestion && ['YES', 'NO', 'UNKNOWN'].includes(suggestion.verdict) && typeof suggestion.reason === 'string' && (suggestion.evidenceHash === undefined || /^[a-f0-9]{64}$/.test(suggestion.evidenceHash)), 'Invalid suggestion'); return { ...c, status: 'suggested', suggestion }; }
export function confirmSuggestion(c) { requireState(c.status === 'suggested' && c.suggestion, 'No suggestion to confirm'); return { ...c, status: 'confirmed', finalVerdict: c.suggestion.verdict }; }
export function rejectSuggestion(c) { requireState(c.status === 'suggested', 'No suggestion to reject'); const { suggestion, ...rest } = c; return { ...rest, status: 'suggestion_rejected', finalVerdict: undefined }; }
export function toReceipt(c, now = new Date()) { if (c.status !== 'confirmed' || !c.finalVerdict) return null; return { callId: c.id, question: c.question, verdict: c.finalVerdict, canceled: c.finalVerdict === 'UNKNOWN', eventTime: c.eventTime, rule: c.rule, zone: { ...c.zone }, evidenceHash: c.suggestion?.evidenceHash, source: c.suggestion?.source, confirmedAt: now.toISOString() }; }
export function validateZone(z) { return !!z && ['x','y','w','h'].every(k => typeof z[k] === 'number' && Number.isFinite(z[k])) && z.x >= 0 && z.y >= 0 && z.w > 0 && z.h > 0 && z.x + z.w <= 1 && z.y + z.h <= 1; }


