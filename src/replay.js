import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { approveProposal, attachSuggestion, confirmSuggestion, toReceipt, validateZone } from '../packages/domain/core.js';

try {
  const path = process.argv[2];
  if (!path) throw new Error('Usage: node src/replay.js <fixture.json>');
  const fixture = JSON.parse(await readFile(path, 'utf8'));
  const receipts = fixture.calls.map(item => {
    // The legacy fixture uses width/height; canonical domain uses w/h, all normalized.
    const zone = { x: item.zone.x, y: item.zone.y, w: item.zone.width, h: item.zone.height };
    if (!validateZone(zone)) throw new Error('Invalid replay zone');
    let call = { id: item.id, question: item.question, rule: item.question, zone, supporterIds: [...new Set(item.viewers)], status: 'proposed', eventTime: item.observation.eventTime };
    call = approveProposal(call);
    const o = item.observation;
    let verdict = 'UNKNOWN'; let reason = 'insufficient-evidence';
    if (o.visible === true && o.changed === true && typeof o.evidence === 'string' && o.evidence && Number.isFinite(o.probability) && o.probability >= 0 && o.probability <= 1) {
      if (o.probability >= 0.9) { verdict = 'YES'; reason = 'probability-high'; }
      else if (o.probability <= 0.1) { verdict = 'NO'; reason = 'probability-low'; }
      else reason = 'probability-ambiguous';
    }
    const evidenceHash = typeof o.evidence === 'string' && o.evidence ? createHash('sha256').update(o.evidence).digest('hex') : undefined;
    call = attachSuggestion(call, { verdict, reason, evidenceHash });
    call = confirmSuggestion(call);
    return { call, receipt: toReceipt(call, new Date(o.eventTime)) };
  });
  console.log(JSON.stringify(receipts, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
