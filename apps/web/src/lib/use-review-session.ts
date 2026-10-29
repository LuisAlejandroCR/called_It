// use-review-session.ts: React state for one simulated review session (calls, receipts, oracle status).
// All transitions go through review.ts; this hook only wires them to UI state and the simulated oracle.
import { useCallback, useEffect, useRef, useState } from "react";
import { createDemoState, type Oracle } from "./demo-data";
import {
  approveProposal,
  attachSuggestion,
  confirmSuggestion,
  isPending,
  rejectProposal,
  rejectSuggestion,
  toReceipt,
  type Call,
  type Receipt,
} from "./review";

export type OracleStatus = "loading" | "error";

export interface ReviewSession {
  booting: boolean;
  calls: Call[];
  pending: Call[];
  receipts: Receipt[];
  selected: Call | null;
  oracle: Record<string, OracleStatus>;
  notice: string | null;
  select: (id: string) => void;
  approve: (c: Call) => void;
  rejectProposal: (c: Call) => void;
  retryOracle: (c: Call) => void;
  confirm: (c: Call) => void;
  rejectSuggestion: (c: Call) => void;
  dismissNotice: () => void;
  reset: () => void;
}

export function useReviewSession(oracle: Oracle, bootDelay = 600): ReviewSession {
  const [initial] = useState(createDemoState);
  const [booting, setBooting] = useState(bootDelay > 0);
  const [calls, setCalls] = useState<Call[]>(initial.calls);
  const [receipts, setReceipts] = useState<Receipt[]>(initial.receipts);
  const [selectedId, setSelectedId] = useState<string | null>(
    initial.calls.find(isPending)?.id ?? null,
  );
  const [oracleStatus, setOracleStatus] = useState<Record<string, OracleStatus>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const epoch = useRef(0); // lets a reset ignore answers from the previous session

  useEffect(() => {
    if (bootDelay <= 0) return;
    const t = setTimeout(() => setBooting(false), bootDelay);
    return () => clearTimeout(t);
  }, [bootDelay]);

  const pending = calls.filter(isPending);
  const selected = calls.find((c) => c.id === selectedId && isPending(c)) ?? null;

  const replace = (c: Call) => setCalls((cs) => cs.map((x) => (x.id === c.id ? c : x)));
  const selectNext = (doneId: string) =>
    setSelectedId(calls.find((c) => c.id !== doneId && isPending(c))?.id ?? null);

  const runOracle = useCallback(
    (c: Call) => {
      const mine = epoch.current;
      setOracleStatus((o) => ({ ...o, [c.id]: "loading" }));
      oracle(c.id)
        .then((s) => {
          if (mine !== epoch.current) return;
          setCalls((cs) =>
            cs.map((x) => (x.id === c.id && x.status === "awaiting_suggestion" ? attachSuggestion(x, s) : x)),
          );
          setOracleStatus(({ [c.id]: _done, ...rest }) => rest);
        })
        .catch(() => {
          if (mine !== epoch.current) return;
          setOracleStatus((o) => ({ ...o, [c.id]: "error" }));
        });
    },
    [oracle],
  );

  return {
    booting,
    calls,
    pending,
    receipts,
    selected,
    oracle: oracleStatus,
    notice,
    select: setSelectedId,
    approve: (c) => {
      const next = approveProposal(c);
      replace(next);
      runOracle(next);
    },
    rejectProposal: (c) => {
      replace(rejectProposal(c));
      setNotice(`Proposal rejected: “${c.question}”. No receipt was created.`);
      selectNext(c.id);
    },
    retryOracle: runOracle,
    confirm: (c) => {
      const done = confirmSuggestion(c);
      replace(done);
      const r = toReceipt(done);
      if (r) setReceipts((rs) => [r, ...rs]);
      setNotice(
        r?.canceled
          ? `Confirmed UNKNOWN: “${c.question}” is canceled and added to receipts.`
          : `Confirmed ${r?.verdict}: receipt added for “${c.question}”.`,
      );
      selectNext(c.id);
    },
    rejectSuggestion: (c) => {
      replace(rejectSuggestion(c));
      setNotice(`Suggestion rejected for “${c.question}”. No outcome selected and no receipt created.`);
      selectNext(c.id);
    },
    dismissNotice: () => setNotice(null),
    reset: () => {
      epoch.current += 1;
      const fresh = createDemoState();
      setCalls(fresh.calls);
      setReceipts(fresh.receipts);
      setSelectedId(fresh.calls.find(isPending)?.id ?? null);
      setOracleStatus({});
      setNotice("Demo data restored.");
    },
  };
}
