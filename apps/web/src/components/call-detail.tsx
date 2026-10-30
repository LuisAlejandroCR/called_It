// call-detail.tsx: simulated video preview with the marked zone, plus the review panel
// (approve/reject proposal, oracle suggestion, confirm/reject suggestion).
import { AlertTriangle, EyeOff, Info, Loader2 } from "lucide-react";
import kitchen from "@/assets/stream-kitchen.jpg";
import type { OracleStatus } from "@/lib/use-review-session";
import { supporterCount, type Call } from "@/lib/review";
import { cn } from "@/lib/utils";
import { btnOutline, btnPrimary, DemoTag, VerdictBadge } from "./ui";

interface Props {
  call: Call;
  oracleStatus?: OracleStatus | undefined;
  onApprove: () => void;
  onRejectProposal: () => void;
  onRetry: () => void;
  onConfirm: () => void;
  onRejectSuggestion: () => void;
}

export function CallPreview({ call }: { call: Call }) {
  const unclear = call.status === "suggested" && !!call.suggestion?.unclearCamera;
  return (
    <figure className="surface relative overflow-hidden bg-foreground p-0">
      <img
        src={kitchen}
        alt="Simulated stream preview: a pot on a stove with the target zone marked"
        width={1280}
        height={720}
        className={cn("aspect-video w-full object-cover", unclear && "blur-[3px] brightness-90")}
      />
      <div
        className="absolute rounded-sm border-[3px] border-zone"
        style={{ left: `${call.zone.x * 100}%`, top: `${call.zone.y * 100}%`, width: `${call.zone.w * 100}%`, height: `${call.zone.h * 100}%` }}
        aria-hidden
      />
      {/* Opaque bar: the demo still carries its own "LIVE" badge and timestamp, which must not read as real. */}
      <div className="absolute inset-x-0 top-0 flex h-9 items-center justify-between gap-2 bg-foreground px-3 text-xs font-semibold text-primary-foreground">
        <span>Simulated preview · Demo data</span>
        {unclear && (
          <span className="inline-flex items-center gap-1.5">
            <EyeOff className="size-3.5" aria-hidden /> Camera view unclear
          </span>
        )}
      </div>
      <figcaption className="sr-only">
        The cyan rectangle marks the target zone used to resolve this call. The preview is a static demo image.
      </figcaption>
    </figure>
  );
}

export function CallPanel({ call, oracleStatus, ...on }: Props) {
  const s = call.suggestion;
  return (
    <article className="surface flex flex-col p-5" aria-labelledby="detail-h">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-twitch-soft px-2.5 py-1 text-xs font-semibold text-twitch">
          <span className="size-1.5 rounded-full bg-twitch" aria-hidden />
          {call.status === "proposed" ? "New proposal" : "Call needs review"}
        </span>
        <DemoTag />
      </div>
      <h2 id="detail-h" className="mt-3 text-2xl font-extrabold tracking-tight">
        {call.question}
      </h2>
      <p className="mt-1 font-bold">{supporterCount(call)} supporters</p>
      <p className="mt-1 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">Rule:</span> {call.rule}
      </p>

      <div className="mt-5 flex-1">
        {call.status === "proposed" && (
          <div className="space-y-2">
            <button className={btnPrimary} onClick={on.onApprove}>
              Approve proposal
            </button>
            <button className={btnOutline} onClick={on.onRejectProposal}>
              Reject proposal
            </button>
          </div>
        )}

        {call.status === "awaiting_suggestion" && oracleStatus !== "error" && (
          <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl bg-muted p-4 text-sm">
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
            Observation pending. <button className="rounded-lg border border-input px-3 py-2 font-semibold" onClick={on.onRetry}>Use UNKNOWN without camera</button>
          </div>
        )}

        {call.status === "awaiting_suggestion" && oracleStatus === "error" && (
          <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold text-destructive">
              <AlertTriangle className="size-4" aria-hidden /> Couldn’t get a suggestion
            </p>
            <p className="text-muted-foreground">The simulated oracle timed out. Nothing has been decided.</p>
            <button className={btnOutline} onClick={on.onRetry}>
              Try again
            </button>
          </div>
        )}

        {call.status === "suggested" && s && (
          <div className="space-y-3">
            <section aria-label="Oracle suggestion" className="rounded-xl bg-accent/60 p-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                Oracle suggestion
                <Info className="size-4 text-muted-foreground" aria-hidden />
                <span className="sr-only">Not final until you confirm.</span>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <VerdictBadge verdict={s.verdict} />
                {s.unclearCamera && <span className="text-sm font-medium">Camera view unclear</span>}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{s.reason}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {s.source === "camera-metrics" ? "Camera measurements from the local browser; not verified and not final until confirmed." : "Offline suggestion; not final until confirmed."}
                {s.verdict === "UNKNOWN" && " Confirming UNKNOWN cancels the call. It is not treated as NO."}
              </p>
            </section>
            <button className={btnPrimary} onClick={on.onConfirm}>
              Confirm {s.verdict}
            </button>
            <button className={btnOutline} onClick={on.onRejectSuggestion}>
              Reject suggestion
            </button>
          </div>
        )}
      </div>
    </article>
  );
}





