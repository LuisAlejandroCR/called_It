import { useCallback, useEffect, useRef, useState } from "react";
import { isPending, type Call, type Receipt } from "./review";
import type { Oracle } from "./demo-data";
export type OracleStatus = "loading" | "error";
export interface ReviewSession {
  booting: boolean; connected: boolean; calls: Call[]; pending: Call[]; receipts: Receipt[]; selected: Call | null;
  oracle: Record<string, OracleStatus>; notice: string | null; select: (id: string) => void;
  approve: (c: Call) => void; rejectProposal: (c: Call) => void; retryOracle: (c: Call) => void;
  confirm: (c: Call) => Promise<boolean>; rejectSuggestion: (c: Call) => void; dismissNotice: () => void; reset: () => void;
}
type State = { calls: Call[]; receipts: Receipt[] };
const request = async (url: string, init?: RequestInit) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); }
};
const endpoint = (process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:4174').replace(/\/$/, '');
export function useReviewSession(_oracle: Oracle, _bootDelay = 600): ReviewSession {
  const [data, setData] = useState<State>({ calls: [], receipts: [] });
  const [connected, setConnected] = useState(false); const [booting, setBooting] = useState(true); const [notice, setNotice] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null); const [oracle, setOracle] = useState<Record<string, OracleStatus>>({});
  const revision = useRef(0);
  const refresh = useCallback(async () => {
    const started = ++revision.current;
    try { const r = await request(`${endpoint}/api/state`); if (!r.ok) throw new Error(); const next = await r.json() as State; if (started !== revision.current) return; setData(next); setConnected(true); setNotice(previous => previous?.startsWith('Connection lost') ? 'Reconnected to local server.' : previous); }
    catch { if (started !== revision.current) return; setConnected(false); setNotice('Connection lost. Retrying local server; displayed data may be stale.'); }
    finally { setBooting(false); }
  }, []);
  useEffect(() => { void refresh(); const timer = setInterval(() => void refresh(), 5000); return () => clearInterval(timer); }, [refresh]);
  const act = async (action: string, c: Call) => {
    revision.current++;
    try { const r = await request(`${endpoint}/api/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, input: { id: c.id } }) }); const body = await r.json(); if (!r.ok) throw new Error(body.error || 'Request failed'); revision.current++; setData(body as State); setConnected(true); return true; }
    catch { setConnected(false); setNotice('Connection lost or action rejected. Retrying local server; displayed data may be stale.'); void refresh(); return false; }
  };
  const pending = data.calls.filter(isPending); const selected = pending.find(c => c.id === selectedId) ?? pending[0] ?? null;
  return { ...data, pending, selected, booting, connected, notice, oracle, select: setSelectedId,
    approve: c => { void act('approve', c); }, rejectProposal: c => { void act('reject-proposal', c); },
    retryOracle: c => { setOracle({ [c.id]: 'loading' }); void act('observe', c).then(ok => setOracle(ok ? {} : { [c.id]: 'error' })); },
    confirm: c => act('confirm', c), rejectSuggestion: c => { void act('reject-suggestion', c); },
    dismissNotice: () => setNotice(null), reset: () => { void refresh(); },
  };
}




