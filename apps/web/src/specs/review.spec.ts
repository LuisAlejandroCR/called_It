// review.spec.ts: review transitions and UNKNOWN behavior (pure state machine, no UI).
import { describe, expect, it } from "vitest";
import {
  approveProposal,
  attachSuggestion,
  confirmSuggestion,
  isPending,
  rejectProposal,
  rejectSuggestion,
  supporterCount,
  toReceipt,
  type Call,
  type Verdict,
} from "@/lib/review";

const base: Call = {
  id: "c1",
  question: "Will it boil over?",
  rule: "Water crosses the pot rim inside the zone",
  supporterIds: ["a", "b", "a"],
  zone: { x: 0, y: 0, w: 0.1, h: 0.1 },
  status: "proposed",
  eventTime: "2026-10-29T20:14:00Z",
};

const suggested = (verdict: Verdict) =>
  attachSuggestion(approveProposal(base), { verdict, reason: "r", evidenceHash: "a".repeat(64) });

describe("review transitions", () => {
  it("counts distinct supporters", () => expect(supporterCount(base)).toBe(2));

  it("confirming YES creates a final receipt with rule, zone and hash", () => {
    const r = toReceipt(confirmSuggestion(suggested("YES")));
    expect(r).toMatchObject({ verdict: "YES", canceled: false, evidenceHash: "a".repeat(64), rule: base.rule, zone: base.zone });
  });

  it("confirming NO creates a final, not canceled receipt", () => {
    expect(toReceipt(confirmSuggestion(suggested("NO")))).toMatchObject({ verdict: "NO", canceled: false });
  });

  it("confirming UNKNOWN stays UNKNOWN and is canceled, never NO", () => {
    const c = confirmSuggestion(suggested("UNKNOWN"));
    expect(c.finalVerdict).toBe("UNKNOWN");
    expect(toReceipt(c)).toMatchObject({ verdict: "UNKNOWN", canceled: true });
  });

  it("rejecting a suggestion selects no verdict, not even the opposite, and makes no receipt", () => {
    for (const v of ["YES", "NO", "UNKNOWN"] as const) {
      const c = rejectSuggestion(suggested(v));
      expect(c.status).toBe("suggestion_rejected");
      expect(c.finalVerdict).toBeUndefined();
      expect(c.suggestion).toBeUndefined();
      expect(toReceipt(c)).toBeNull();
      expect(isPending(c)).toBe(false);
    }
  });

  it("a rejected proposal produces no receipt", () => {
    expect(toReceipt(rejectProposal(base))).toBeNull();
  });

  it("an unconfirmed suggestion is not final", () => {
    for (const v of ["YES", "NO", "UNKNOWN"] as const) expect(toReceipt(suggested(v))).toBeNull();
  });

  it("rejects transitions from the wrong state", () => {
    expect(() => confirmSuggestion(approveProposal(base))).toThrow();
    expect(() => rejectSuggestion(base)).toThrow();
    expect(() => approveProposal(rejectProposal(base))).toThrow();
    expect(() => attachSuggestion(base, { verdict: "YES", reason: "r" })).toThrow();
  });

  it("a confirmed call cannot be rejected or confirmed again", () => {
    const done = confirmSuggestion(suggested("YES"));
    expect(() => rejectSuggestion(done)).toThrow();
    expect(() => confirmSuggestion(done)).toThrow();
  });
});

