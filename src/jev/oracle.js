// JEV receives text observations, never images or client-selected verdicts.
// This adapter is deliberately transport-independent until the live API is verified.
export function buildRequest({ question, observations }) {
  if (typeof question !== 'string' || !question.trim() || question.length > 500) throw new Error('invalid question');
  if (!Array.isArray(observations) || observations.length === 0 || observations.length > 20 || observations.some(x => typeof x !== 'string' || !x.trim() || x.length > 500)) throw new Error('invalid observations');
  return { question, observations: [...observations] };
}

// The caller supplies a trusted, versioned observation producer and a replay or live transport.
// All failures and missing visibility fail closed. Thresholds must be calibrated before use.
export async function evaluate({ question, observations, visible, changed, eventTime, evidenceHash }, { classify, thresholds } = {}) {
  const unknown = (reason) => ({ verdict: 'UNKNOWN', reason, eventTime, evidenceHash: evidenceHash ?? null });
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(eventTime ?? '') || !Number.isFinite(Date.parse(eventTime))) return unknown('invalid-event-time');
  if (!/^[a-f0-9]{64}$/.test(evidenceHash ?? '') || visible !== true || changed !== true) return unknown('insufficient-evidence');
  if (!thresholds || !Number.isFinite(thresholds.low) || !Number.isFinite(thresholds.high) || thresholds.low < 0 || thresholds.high > 1 || thresholds.low >= thresholds.high) return unknown('thresholds-not-configured');
  try {
    const input = buildRequest({ question, observations });
    if (typeof classify !== 'function') return unknown('classifier-unavailable');
    const probability = await classify(input);
    if (!Number.isFinite(probability) || probability < 0 || probability > 1) return unknown('invalid-classifier-response');
    const verdict = probability >= thresholds.high ? 'YES' : probability <= thresholds.low ? 'NO' : 'UNKNOWN';
    return { verdict, reason: verdict === 'UNKNOWN' ? 'ambiguous' : verdict === 'YES' ? 'above-high' : 'below-low', probability, eventTime, evidenceHash };
  } catch {
    return unknown('classifier-failed');
  }
}
