// format.ts: event-time formatting shared by the screens.
const clock = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/** "Today at 8:14 PM", or "Oct 29, 8:14 PM" for any other day. */
export function formatEventTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (d.toDateString() === now.toDateString()) return `Today at ${clock(d)}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${clock(d)}`;
}
