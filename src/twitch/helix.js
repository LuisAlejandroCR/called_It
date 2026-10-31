// Twitch OAuth validation and Predictions transport. Tokens stay server-side.
export async function validateBroadcaster({ token, clientId, broadcasterId, fetchImpl = fetch }) {
  if (!token || !clientId || !broadcasterId) throw new Error('Twitch credentials are incomplete');
  const response = await fetchImpl('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: `OAuth ${token}` } });
  if (!response.ok) throw new Error('Twitch token validation failed');
  const info = await response.json();
  if (info.client_id !== clientId || info.user_id !== broadcasterId || !Array.isArray(info.scopes) || !info.scopes.includes('channel:manage:predictions') || !Number.isFinite(info.expires_in) || info.expires_in <= 0) throw new Error('Twitch token identity, scope, or expiry mismatch');
  return { broadcasterId: info.user_id, expiresIn: info.expires_in };
}

export function predictionClient({ token, clientId, broadcasterId, fetchImpl = fetch }) {
  const request = async (method, body) => {
    await validateBroadcaster({ token, clientId, broadcasterId, fetchImpl });
    const response = await fetchImpl('https://api.twitch.tv/helix/predictions', { method, headers: { Authorization: `Bearer ${token}`, 'Client-Id': clientId, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(`Twitch Predictions request failed (${response.status})`);
    const payload = await response.json();
    if (!Array.isArray(payload.data) || !payload.data[0]) throw new Error('Invalid Twitch response');
    return payload.data[0];
  };
  return {
    get: async id => {
      if (typeof id !== 'string' || !id) throw new Error('Invalid prediction id');
      await validateBroadcaster({ token, clientId, broadcasterId, fetchImpl });
      const url = new URL('https://api.twitch.tv/helix/predictions'); url.searchParams.set('broadcaster_id', broadcasterId); url.searchParams.set('id', id);
      const response = await fetchImpl(url.toString(), { headers: { Authorization: `Bearer ${token}`, 'Client-Id': clientId } });
      if (!response.ok) throw new Error('Prediction lookup failed');
      const payload = await response.json();
      if (!Array.isArray(payload.data) || payload.data.length !== 1 || payload.data[0]?.id !== id) throw new Error('Prediction not found');
      return payload.data[0];
    },
    create: (title, seconds = 60) => {
      if (typeof title !== 'string' || !title.trim() || title.length > 45 || !Number.isInteger(seconds) || seconds < 30 || seconds > 1800) throw new Error('Invalid prediction');
      return request('POST', { broadcaster_id: broadcasterId, title, outcomes: [{ title: 'YES' }, { title: 'NO' }], prediction_window: seconds });
    },
    close: (id, verdict, outcomes) => {
      if (typeof id !== 'string' || !id || !['YES','NO','UNKNOWN'].includes(verdict)) throw new Error('Invalid resolution');
      if (verdict === 'UNKNOWN') return request('PATCH', { broadcaster_id: broadcasterId, id, status: 'CANCELED' });
      const matches = Array.isArray(outcomes) ? outcomes.filter(o => o.title === verdict && typeof o.id === 'string' && o.id) : [];
      if (matches.length !== 1) throw new Error('Missing or ambiguous outcome');
      return request('PATCH', { broadcaster_id: broadcasterId, id, status: 'RESOLVED', winning_outcome_id: matches[0].id });
    }
  };
}

