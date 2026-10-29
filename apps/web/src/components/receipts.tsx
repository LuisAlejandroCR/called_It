// receipts.tsx: the receipt wall. Only confirmed outcomes are listed; each row expands to show
// rule, zone time and evidence hash (when the oracle provided one).
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import type { Receipt } from "@/lib/review";
import { cn, formatEventTime } from "@/lib/utils";
import { DemoTag, VerdictBadge, ZoneThumb } from "./ui";

export function ReceiptWall({
  receipts,
  title,
  subtitle,
  limit,
}: {
  receipts: Receipt[];
  title: string;
  subtitle: string;
  limit?: number;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const shown = limit ? receipts.slice(0, limit) : receipts;
  return (
    <section aria-labelledby="receipts-h" className="surface p-5 sm:p-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 id="receipts-h" className="text-xl font-bold">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <DemoTag />
      </div>
      {shown.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No receipts yet. Confirm a suggestion to create one.
        </p>
      ) : (
        <table className="mt-4 w-full text-left">
          <caption className="sr-only">Confirmed outcomes, newest first</caption>
          <thead className="text-sm text-muted-foreground">
            <tr className="border-b border-border">
              <th scope="col" className="py-2 font-semibold">Question</th>
              <th scope="col" className="hidden py-2 font-semibold sm:table-cell">Event time</th>
              <th scope="col" className="py-2 font-semibold">Outcome</th>
              <th scope="col" className="w-8">
                <span className="sr-only">Details</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const expanded = open === r.callId;
              return [
                <tr key={r.callId} className={cn(!expanded && "border-b border-border last:border-0")}>
                  <th scope="row" className="py-3 pr-3 font-medium">
                    <button
                      aria-expanded={expanded}
                      aria-controls={`receipt-${r.callId}`}
                      onClick={() => setOpen(expanded ? null : r.callId)}
                      className="flex w-full items-center gap-3 rounded-md text-left"
                    >
                      <ZoneThumb zone={r.zone} />
                      <span>
                        {r.question}
                        <span className="block text-xs font-normal text-muted-foreground sm:hidden">
                          {formatEventTime(r.eventTime)}
                        </span>
                      </span>
                    </button>
                  </th>
                  <td className="hidden py-3 pr-3 text-sm text-muted-foreground sm:table-cell">
                    {formatEventTime(r.eventTime)}
                  </td>
                  <td className="py-3 pr-2">
                    <VerdictBadge verdict={r.verdict} canceled={r.canceled} />
                  </td>
                  <td aria-hidden className="py-3 text-muted-foreground">
                    <ChevronRight className={cn("size-4 transition-transform", expanded && "rotate-90")} />
                  </td>
                </tr>,
                expanded && (
                  <tr key={`${r.callId}-d`} className="border-b border-border">
                    <td colSpan={4} id={`receipt-${r.callId}`} className="pb-4">
                      <dl className="grid gap-x-6 gap-y-1 rounded-lg bg-muted p-3 text-sm sm:grid-cols-[auto_1fr]">
                        <dt className="font-semibold">Rule</dt>
                        <dd className="text-muted-foreground">{r.rule}</dd>
                        <dt className="font-semibold">Event time</dt>
                        <dd className="text-muted-foreground">{formatEventTime(r.eventTime)}</dd>
                        <dt className="font-semibold">Evidence hash</dt>
                        <dd className="font-mono text-muted-foreground">{r.evidenceHash ?? "Not available"}</dd>
                        <dt className="font-semibold">Confirmed</dt>
                        <dd className="text-muted-foreground">
                          {formatEventTime(r.confirmedAt)} by the streamer (simulated)
                        </dd>
                      </dl>
                      <p className="mt-2 text-xs text-muted-foreground">
                        A receipt records the rule and the evidence that were used. It does not prove what happened on camera.
                      </p>
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
