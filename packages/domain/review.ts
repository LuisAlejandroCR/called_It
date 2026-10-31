// review.ts: review state machine for Called It (pure functions, no I/O).
// Shared UI review model; replay uses a separate legacy model.
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
  source?: "camera-metrics" | "offline";
  unclearCamera?: boolean;
  evidenceHash?: string | undefined;
}

/** Normalized coordinates of the video frame (0–1). */
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
  localVotes?: { viewerId: string; choice: "YES" | "NO" }[];
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
  source?: "camera-metrics" | "offline";
}

export { supporterCount, isPending, approveProposal, rejectProposal, attachSuggestion, confirmSuggestion, rejectSuggestion, toReceipt, validateZone } from "./core.js";


