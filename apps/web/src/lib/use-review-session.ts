import { useCallback, useEffect, useRef, useState } from "react";
import { isPending, type Call, type Receipt } from "./review";
import type { Oracle } from "./demo-data";

export type OracleStatus = "loading" | "error";
export interface ReviewSession {
  mode: "local" | "twitch"; setOperatorKey: (key: string) => void; booting: boolean; calls: Call[]; pending: Call[]; receipts: Receipt[]; selected: Call | null;
  oracle: Record<string, OracleStatus>; notice: string | null; select: (id: string) => void;
  approve: (c: Call) => void; rejectProposal: (c: Call) => void; retryOracle: (c: Call) => void;
  confirm: (c: Call) => void; rejectSuggestion: (c: Call) => void; dismissNotice: () => void; reset: () => void;
  vote: (c: Call, viewerId: string, choice: "YES" | "NO") => void; capture: (c: Call, sample?: object) => void; create: (question: string, rule: string, zone: { x: number; y: number; w: number; h: number }) => void; support: (c: Call, viewerId: string) => void;
}
type State = { calls: Call[]; receipts: Receipt[]; mode?: "local" | "twitch" };
export function useReviewSession(_oracle: Oracle, _bootDelay = 600): ReviewSession {
  const [state, setState] = useState<State>({ calls: [], receipts: [] });
  const operatorKey = useRef("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [oracle, setOracle] = useState<Record<string, OracleStatus>>({});
  const refresh = useCallback(async () => {
    try { const r = await fetch('/api/state'); if (!r.ok) throw new Error('Local server unavailable'); const data: State = await r.json(); setState(data); setSelectedId(id => id ?? data.calls.find(isPending)?.id ?? null); }
    catch { setNotice('Local server unavailable. Start npm run local:server.'); }
    finally { setBooting(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const act = async (action: string, input: object, message?: string) => {
    try {
      const r = await fetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, input }) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Request failed');
      setState(data as State); if (message) setNotice(message);
      return data as State;
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Request failed'); return null; }
  };
  const twitchAct = async (action: 'approve' | 'confirm', id: string) => {
    if (!operatorKey.current) { setNotice('Enter the local operator key in Settings first.'); return; }
    try {
      const r = await fetch('/api/twitch', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${operatorKey.current}` }, body: JSON.stringify({ action, id }) });
      const result = await r.json(); if (!r.ok) throw new Error(result.error || 'Twitch action failed');
      setState({ ...result.state, mode: 'twitch' });
      setNotice(action === 'confirm' ? 'Twitch response confirmed. Review the receipt and prediction status.' : 'Twitch prediction opened.');
    } catch { setNotice('Twitch action failed or is uncertain. Refresh and reconcile before retrying.'); await refresh(); }
  };
  const pending = state.calls.filter(isPending);
  const selected = pending.find(c => c.id === selectedId) ?? pending[0] ?? null;
  const observe = async (c: Call) => { setOracle(o => ({ ...o, [c.id]: 'loading' })); const result = await act('observe', { id: c.id }); setOracle(o => { const { [c.id]: _, ...rest } = o; return result ? rest : { ...rest, [c.id]: 'error' }; }); };
  return {
    booting, ...state, mode: state.mode ?? "local", setOperatorKey: key => { operatorKey.current = key; setNotice("Operator key set in memory for this tab."); }, pending, selected, oracle, notice, select: setSelectedId,
    approve: c => { if (state.mode === 'twitch') void twitchAct('approve', c.id); else void act('approve', { id: c.id }); },
    rejectProposal: c => { void act('reject-proposal', { id: c.id }, 'Proposal rejected. No receipt was created.'); },
    retryOracle: c => { void observe(c); },
    confirm: c => { if (state.mode === 'twitch') void twitchAct('confirm', c.id); else void act('confirm', { id: c.id }, 'Confirmed. Receipt saved locally.'); },
    rejectSuggestion: c => { void act('reject-suggestion', { id: c.id }, 'Suggestion rejected. No outcome selected and no receipt created.'); },
    capture: (c, sample) => { void act('observe', sample ? { id: c.id, sample } : { id: c.id }); },
    dismissNotice: () => setNotice(null), reset: () => { void refresh(); },
    create: (question, rule, zone) => { void (async () => { const result = await act('create', { question, rule, zone }, 'Proposal created.'); if (result) setSelectedId(result.calls.at(-1)?.id ?? null); })(); },
    vote: (c, viewerId, choice) => { void act("vote", { id: c.id, viewerId, choice }, "Local vote recorded; duplicate identities keep their first vote."); },
    support: (c, viewerId) => { void act('support', { id: c.id, viewerId }, 'Support recorded for this demo identity.'); },
  };
}





