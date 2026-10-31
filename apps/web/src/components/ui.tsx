// ui.tsx: small shared pieces (demo tag, verdict badge, buttons, zone thumbnail).
// Keeps the "this is simulated" and "UNKNOWN is not NO" presentation consistent everywhere.
import { Check, CircleHelp, X } from "lucide-react";
import kitchen from "@/assets/stream-kitchen.jpg";
import type { Verdict, Zone } from "@/lib/review";
import { cn } from "@/lib/utils";

export function DemoTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      Demo data
    </span>
  );
}

export function VerdictBadge({ verdict, canceled }: { verdict: Verdict; canceled?: boolean }) {
  const styles = {
    YES: "bg-success-soft text-success",
    NO: "bg-destructive/10 text-destructive",
    UNKNOWN: "bg-unknown-soft text-unknown",
  }[verdict];
  const Icon = verdict === "YES" ? Check : verdict === "NO" ? X : CircleHelp;
  return (
    <span className={cn("inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold", styles)}>
      <Icon className="size-3.5" aria-hidden />
      {verdict}
      {canceled && <span className="font-medium">· canceled</span>}
    </span>
  );
}

const btn =
  "inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-50";
export const btnPrimary = `${btn} bg-primary text-primary-foreground hover:bg-primary/90`;
export const btnOutline = `${btn} border border-input bg-card text-foreground hover:bg-secondary`;

/** Decorative crop of the demo still around a zone. The still is static; no video is stored. */
export function ZoneThumb({ zone }: { zone: Zone }) {
  const px = zone.w >= 1 ? 0 : (zone.x / (1 - zone.w)) * 100;
  const py = zone.h >= 1 ? 0 : (zone.y / (1 - zone.h)) * 100;
  return (
    <span
      aria-hidden
      className="hidden h-10 w-16 shrink-0 sm:block rounded-md bg-muted bg-no-repeat"
      style={{
        backgroundImage: `url(${kitchen})`,
        backgroundSize: `${100 / zone.w}% auto`,
        backgroundPosition: `${px}% ${py}%`,
      }}
    />
  );
}


