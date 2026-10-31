// A bounded demo: fraction of strongly red pixels in the selected crop.
// The observation is untrusted local-client data; it is not proof of the scene.
export function evaluateRedSample(sample) {
  if (!sample || sample.kind !== 'red-pixel-v1' || !Number.isInteger(sample.count) || sample.count < 256 || sample.count > 65536 || !Number.isInteger(sample.red) || sample.red < 0 || sample.red > sample.count || !Number.isFinite(sample.meanLight) || sample.meanLight < 25 || sample.meanLight > 245 || !/^[a-f0-9]{64}$/.test(sample.hash ?? '') || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(sample.capturedAt ?? '') || !Number.isFinite(Date.parse(sample.capturedAt))) return { verdict: 'UNKNOWN', reason: 'Image missing or insufficient.' };
  const fraction = sample.red / sample.count;
  if (fraction >= 0.2) return { verdict: 'YES', reason: 'At least 20% of sampled pixels are strongly red.' };
  return { verdict: 'UNKNOWN', reason: 'Red signal below demo threshold; absence cannot be established.' };
}
