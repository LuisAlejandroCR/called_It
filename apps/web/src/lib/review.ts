// review.ts: review state machine for Called It (pure functions, no I/O).
// UI-level model for the prototype; it does not share code with ../../../src/call.js (see README).
export type Verdict = "YES" | "NO" | "UNKNOWN";

export type CallStatus =
  | "proposed" // waiting for the streamer to approve the proposal
  | "proposal_rejected" // no receipt
  | "awaiting_suggestion" // approved, oracle suggestion pending
  | "suggested" // oracle suggestion ready for review (not final)
  | "suggestion_rejected" // streamer rejected the suggestion: no verdict, no receipt
  | "confirmed"; // final

export interface Suggestion {
  verdict: Verdict;
  reason: string;
  unclearCamera?: boolean;
  evidenceHash?: string | undefined;
}

/** Percentages of the video frame (0–100). */
export interface Zone {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Call {
  id: string;
  question: string;
  rule: string;
  supporterIds: string[]; // pseudonymous ids, never names
  zone: Zone;
  status: CallStatus;
  eventTime: string; // ISO
  suggestion?: Suggestion;
  finalVerdict?: Verdict | undefined;
}

export interface Receipt {
  callId: string;
  question: string;
  verdict: Verdict;
  canceled: boolean;
  eventTime: string;
  rule: string;
  zone: Zone;
  evidenceHash?: string | undefined;
  confirmedAt: string;
}

export const supporterCount = (c: Call) => new Set(c.supporterIds).size;

const assert = (ok: boolean, msg: string) => {
  if (!ok) throw new Error(msg);
};

export function approveProposal(c: Call): Call {
  assert(c.status === "proposed", "Only proposed calls can be approved");
  return { ...c, status: "awaiting_suggestion" };
}

export function rejectProposal(c: Call): Call {
  assert(c.status === "proposed", "Only proposed calls can be rejected");
  return { ...c, status: "proposal_rejected" };
}

export function attachSuggestion(c: Call, s: Suggestion): Call {
  assert(c.status === "awaiting_suggestion", "Call is not awaiting a suggestion");
  return { ...c, status: "suggested", suggestion: s };
}

export function confirmSuggestion(c: Call): Call {
  assert(c.status === "suggested" && !!c.suggestion, "No suggestion to confirm");
  // The verdict is exactly the suggestion: UNKNOWN stays UNKNOWN.
  return { ...c, status: "confirmed", finalVerdict: c.suggestion!.verdict };
}

export function rejectSuggestion(c: Call): Call {
  assert(c.status === "suggested", "No suggestion to reject");
  // Rejection never picks the opposite verdict and leaves nothing final.
  const { suggestion: _dropped, ...rest } = c;
  return { ...rest, status: "suggestion_rejected", finalVerdict: undefined };
}

/** A receipt exists only for a confirmed call. */
export function toReceipt(c: Call, now = new Date()): Receipt | null {
  if (c.status !== "confirmed" || !c.finalVerdict) return null;
  return {
    callId: c.id,
    question: c.question,
    verdict: c.finalVerdict,
    canceled: c.finalVerdict === "UNKNOWN",
    eventTime: c.eventTime,
    rule: c.rule,
    zone: { ...c.zone },
    evidenceHash: c.suggestion?.evidenceHash,
    confirmedAt: now.toISOString(),
  };
}

export const isPending = (c: Call) =>
  c.status === "proposed" || c.status === "awaiting_suggestion" || c.status === "suggested";
