// demo-data.ts: simulated calls, receipts and oracle. Copy of apps/web/src/lib/demo-data.ts (keep in sync).
// Everything here is DEMO DATA: no Twitch, no camera analysis, no real viewers (pseudonymous ids only).
import type { Call, Receipt, Suggestion } from "./review";

const today = (h: number, m: number) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};
const ids = (n: number, p: string) => Array.from({ length: n }, (_, i) => `${p}-${i}`);

export function createDemoState(): { calls: Call[]; receipts: Receipt[] } {
  const calls: Call[] = [
    {
      id: "call-boil",
      question: "Will it boil over?",
      rule: "YES if water crosses the pot rim inside the marked zone before the burner is turned off.",
      supporterIds: [...ids(24, "v"), "v-1", "v-2"], // repeated ids count once
      zone: { x: 32, y: 29, w: 36, h: 36 },
      status: "suggested",
      eventTime: today(20, 14),
      suggestion: {
        verdict: "UNKNOWN",
        unclearCamera: true,
        reason: "The pot is partially obscured and the view does not clearly show whether it boiled over.",
      },
    },
    {
      id: "call-salt",
      question: "Will they add salt to the water?",
      rule: "YES if salt is added to the pot inside the marked zone within 5 minutes of approval.",
      supporterIds: ids(11, "w"),
      zone: { x: 34, y: 31, w: 32, h: 32 },
      status: "proposed",
      eventTime: today(20, 20),
    },
  ];
  const receipts: Receipt[] = [
    {
      callId: "r-chop",
      question: "Will they finish chopping the vegetables?",
      verdict: "YES",
      canceled: false,
      eventTime: today(19, 42),
      rule: "YES if the cutting board is cleared inside the zone before 7:45 PM.",
      zone: { x: 5, y: 45, w: 30, h: 40 },
      evidenceHash: "0x9f3a…c21e",
      confirmedAt: today(19, 46),
    },
    {
      callId: "r-pasta",
      question: "Will the pasta be added in the next 5 minutes?",
      verdict: "YES",
      canceled: false,
      eventTime: today(18, 18),
      rule: "YES if pasta enters the pot inside the marked zone within 5 minutes of approval.",
      zone: { x: 36, y: 30, w: 32, h: 34 },
      evidenceHash: "0x4be1…07ad",
      confirmedAt: today(18, 24),
    },
    {
      callId: "r-cheese",
      question: "Will the final dish include cheese?",
      verdict: "UNKNOWN",
      canceled: true,
      eventTime: today(17, 3),
      rule: "YES if cheese is added to the plate inside the marked zone.",
      zone: { x: 60, y: 55, w: 30, h: 35 },
      confirmedAt: today(17, 10),
    },
  ];
  return { calls, receipts };
}

export type Oracle = (callId: string) => Promise<Suggestion>;

/**
 * Simulated oracle. It returns canned suggestions and never looks at any video.
 * "call-salt" fails on its first attempt so the error state can be shown.
 */
export function createSimulatedOracle(delayMs = 1200): Oracle {
  const failedOnce = new Set<string>();
  return (callId) =>
    new Promise((resolve, reject) => {
      setTimeout(() => {
        if (callId === "call-salt" && !failedOnce.has(callId)) {
          failedOnce.add(callId);
          reject(new Error("Simulated oracle timeout"));
          return;
        }
        if (callId === "call-salt") {
          resolve({
            verdict: "YES",
            reason: "Salt was observed entering the pot inside the zone (simulated).",
            evidenceHash: "0x77c0…e9b2",
          });
          return;
        }
        resolve({
          verdict: "NO",
          reason: "Nothing was observed inside the zone during the window (simulated).",
          evidenceHash: "0x12ad…5f90",
        });
      }, delayMs);
    });
}
