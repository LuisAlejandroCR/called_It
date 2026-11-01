// App.tsx: app shell (sidebar, mobile nav, notices) and the four views: Dashboard, Calls, Receipts, Settings.
// Everything shown is simulated; the shell says so on every screen.
import { Bell, Check, FileText, Home, MessageSquare, RotateCcw, Settings, Users, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Camera } from "@/components/camera";
import { ChatAnticipations } from "@/components/chat-anticipations";
import { CallPanel, CallPreview } from "@/components/call-detail";
import { ReceiptWall } from "@/components/receipts";
import { DemoTag } from "@/components/ui";
import { createSimulatedOracle, type Oracle } from "@/lib/demo-data";
import { supporterCount, type Call } from "@/lib/review";
import { useReviewSession, type ReviewSession } from "@/lib/use-review-session";
import { cn } from "@/lib/utils";

type Route = "dashboard" | "calls" | "receipts" | "settings";
const routes: { id: Route; label: string; hash: string; icon: typeof Home }[] = [
  { id: "dashboard", label: "Dashboard", hash: "#/", icon: Home },
  { id: "calls", label: "Calls", hash: "#/calls", icon: MessageSquare },
  { id: "receipts", label: "Receipts", hash: "#/receipts", icon: FileText },
  { id: "settings", label: "Settings", hash: "#/settings", icon: Settings },
];

const routeFromHash = (hash: string): Route =>
  routes.find((r) => r.hash === hash)?.id ?? "dashboard";

function useRoute(): Route {
  const [route, setRoute] = useState(() => routeFromHash(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(routeFromHash(window.location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

const defaultOracle = createSimulatedOracle();

export default function App({ oracle = defaultOracle, bootDelay = 600 }: { oracle?: Oracle; bootDelay?: number }) {
  const session = useReviewSession(oracle, bootDelay);
  const route = useRoute();

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-card px-3 py-2 font-semibold focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-sidebar p-5 md:flex">
          <Brand />
          <nav aria-label="Main" className="mt-8 space-y-1 text-sm font-medium">
            {routes.map((r) => (
              <NavLink key={r.id} route={r} active={route === r.id} />
            ))}
          </nav>
          <div className="mt-auto space-y-2 text-xs text-muted-foreground">
            <DemoTag />
            <p>This is a simulated experience using demo data.</p>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="border-b border-border bg-sidebar px-4 py-3 md:hidden">
            <div className="flex items-center justify-between gap-2">
              <Brand />
              <DemoTag />
            </div>
            <nav aria-label="Main" className="mt-3 grid grid-cols-4 gap-1 text-xs font-medium">
              {routes.map((r) => (
                <NavLink key={r.id} route={r} active={route === r.id} compact />
              ))}
            </nav>
          </div>

          <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-8 sm:py-8">
            <div aria-live="polite" className="empty:hidden">
              {session.notice && (
                <div className="mb-6 flex items-start justify-between gap-3 rounded-lg border border-primary/20 bg-accent px-4 py-3 text-sm text-accent-foreground">
                  <span>{session.notice}</span>
                  <button onClick={session.dismissNotice} aria-label="Dismiss message" className="rounded p-0.5">
                    <X className="size-4" />
                  </button>
                </div>
              )}
            </div>
            {route === "dashboard" && <DashboardView s={session} />}
            {route === "calls" && <CallsView s={session} />}
            {route === "receipts" && (
              <>
                <PageHeading title="Receipts" subtitle="Only outcomes you confirmed appear here." />
                <div className="mt-6">
                  <ReceiptWall receipts={session.receipts} title="Receipt wall" subtitle="Newest first. Open a row for the rule and evidence." />
                </div>
              </>
            )}
            {route === "settings" && <SettingsView s={session} />}
          </main>
        </div>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
      <span className="grid size-8 place-items-center rounded-lg bg-twitch text-primary-foreground">
        <Check className="size-5" strokeWidth={3} aria-hidden />
      </span>
      Called It
    </div>
  );
}

function NavLink({ route, active, compact }: { route: (typeof routes)[number]; active: boolean; compact?: boolean }) {
  const Icon = route.icon;
  return (
    <a
      href={route.hash}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5",
        compact && "flex-col gap-1 px-1 py-2",
        active ? "bg-accent text-accent-foreground" : "hover:bg-secondary",
      )}
    >
      <Icon className="size-4" aria-hidden /> {route.label}
    </a>
  );
}

function PageHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header>
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-1 text-muted-foreground">{subtitle}</p>
    </header>
  );
}

const greeting = (h = new Date().getHours()) => (h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");

function DashboardView({ s }: { s: ReviewSession }) {
  const n = s.pending.length;
  return (
    <>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{greeting()}, Alex</h1>
          <p className="mt-1 text-muted-foreground">Review recent calls, confirm outcomes, and keep the record straight.</p>
        </div>
        <button
          onClick={() => s.pending[0] && s.select(s.pending[0].id)}
          disabled={n === 0}
          className="flex items-center gap-3 rounded-xl bg-twitch-soft px-4 py-3 text-left disabled:cursor-default lg:min-w-80"
        >
          <Bell className="size-5 text-twitch" aria-hidden />
          <span className="flex-1">
            <span className="block font-bold text-twitch">
              {n === 0 ? "All caught up" : `${n} ${n === 1 ? "call needs" : "calls need"} review`}
            </span>
            <span className="block text-sm text-muted-foreground">
              {n === 0 ? "No calls are waiting for review." : "Take a look when you have a moment."}
            </span>
          </span>
        </button>
      </header>

      <section className="surface mt-6 p-5" aria-labelledby="create-call">
        <h2 id="create-call" className="text-lg font-bold">Create a demo proposal</h2>
        <form className="mt-3 flex flex-wrap gap-2" onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          s.create(String(data.get("question") ?? ""), String(data.get("rule") ?? ""), { x: Number(data.get("x")), y: Number(data.get("y")), w: Number(data.get("w")), h: Number(data.get("h")) });
          form.reset();
        }}>
          <label className="flex-1 min-w-48 text-sm">Question<input name="question" required maxLength={500} className="mt-1 block w-full rounded-lg border border-input p-2" /></label>
          <label className="flex-1 min-w-48 text-sm">Rule<input name="rule" required maxLength={500} defaultValue="At least 20% of pixels in the selected zone are strongly red." className="mt-1 block w-full rounded-lg border border-input p-2" /></label>
          {["x", "y", "w", "h"].map((key) => <label key={key} className="w-20 text-sm">{key.toUpperCase()}<input name={key} type="number" required min={0} max={1} step={0.01} defaultValue={key === "x" || key === "y" ? 0.25 : 0.5} className="mt-1 block w-full rounded-lg border border-input p-2" /></label>)}
          <button className="self-end rounded-lg bg-primary px-4 py-2.5 font-semibold text-white">Create proposal</button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">Zone coordinates use fractions from 0 to 1. No Twitch or camera is connected.</p>
      </section>
      {s.selected?.status === "proposed" && (
        <form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; s.support(s.selected!, String(new FormData(form).get("viewerId") ?? "")); form.reset(); }}>
          <label className="text-sm">Demo viewer ID<input name="viewerId" required maxLength={100} className="ml-2 rounded-lg border border-input p-2" /></label>
          <button className="rounded-lg border border-input px-3 font-semibold">Support</button>
        </form>
      )}
      {s.booting ? (
        <div className="mt-6 space-y-4" aria-busy="true" aria-label="Loading calls">
          <div className="surface h-12 animate-pulse bg-muted" />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
            <div className="surface aspect-video animate-pulse bg-muted" />
            <div className="surface min-h-64 animate-pulse bg-muted" />
          </div>
        </div>
      ) : (
        <>
          {n > 0 && (
            <section aria-labelledby="pending-h" className="mt-6">
              <h2 id="pending-h" className="sr-only">Pending calls</h2>
              <ul className="flex flex-wrap gap-2">
                {s.pending.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => s.select(c.id)}
                      aria-pressed={c.id === s.selected?.id}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm",
                        c.id === s.selected?.id ? "border-primary bg-accent" : "border-border bg-card hover:bg-secondary",
                      )}
                    >
                      <span className="font-semibold">{c.question}</span>
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Users className="size-3.5" aria-hidden />
                        {supporterCount(c)} supporters
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
            {s.selected ? (
              <>
                <CallPreview call={s.selected} />
                <CallPanel
                  call={s.selected}
                  oracleStatus={s.oracle[s.selected.id]}
                  onApprove={() => s.approve(s.selected!)}
                  onRejectProposal={() => s.rejectProposal(s.selected!)}
                  onRetry={() => s.retryOracle(s.selected!)}
                  onConfirm={() => s.confirm(s.selected!)}
                  onRejectSuggestion={() => s.rejectSuggestion(s.selected!)}
                />
              </>
            ) : (
              <div className="surface grid min-h-64 place-items-center p-8 text-center text-muted-foreground xl:col-span-2">
                <div>
                  <p className="font-semibold text-foreground">{n === 0 ? "All caught up" : "No call selected"}</p>
                  <p className="mt-1 text-sm">
                    {n === 0 ? "No calls are waiting for review." : "Pick a pending call to review it."}
                  </p>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {s.selected?.status === "awaiting_suggestion" && <section className="surface mt-4 p-4" aria-label="Local demo vote">
        <h2 className="font-bold">Local demo vote</h2><p className="text-sm">No Twitch Channel Points. Each demo identity keeps its first vote; voting closes on observation.</p>
        <p>YES: {s.selected.localVotes?.filter(v => v.choice === "YES").length ?? 0} · NO: {s.selected.localVotes?.filter(v => v.choice === "NO").length ?? 0}</p>
        <form className="mt-3 flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); s.vote(s.selected!, String(data.get("viewerId") ?? ""), data.get("choice") === "NO" ? "NO" : "YES"); form.reset(); }}>
          <label>Demo voter ID <input name="viewerId" required maxLength={100} className="rounded-lg border border-input p-2" /></label>
          <label>Choice <select name="choice" className="rounded-lg border border-input p-2"><option>YES</option><option>NO</option></select></label>
          <button className="rounded-lg bg-primary px-3 py-2 text-white">Submit local vote</button>
        </form>
      </section>}
      {s.selected?.status === "awaiting_suggestion" && <div className="mt-4"><Camera call={s.selected} onCapture={(sample) => s.capture(s.selected!, sample)} /></div>}
      <div className="mt-6">
        <ReceiptWall
          receipts={s.receipts}
          limit={4}
          title="Recent receipts"
          subtitle="A record of your recently confirmed calls."
        />
      </div>
      <ChatAnticipations />
    </>
  );
}

const statusText: Record<Call["status"], string> = {
  proposed: "Proposal waiting",
  awaiting_suggestion: "Oracle checking",
  suggested: "Suggestion ready",
  proposal_rejected: "Proposal rejected",
  suggestion_rejected: "Suggestion rejected · no outcome",
  confirmed: "Confirmed",
};

function CallsView({ s }: { s: ReviewSession }) {
  const go = (c: Call): ReactNode =>
    s.pending.some((p) => p.id === c.id) ? (
      <a
        href="#/"
        onClick={() => s.select(c.id)}
        className="rounded-lg border border-input px-3 py-1.5 text-sm font-semibold hover:bg-secondary"
      >
        Review<span className="sr-only">: {c.question}</span>
      </a>
    ) : null;
  return (
    <>
      <PageHeading title="Calls" subtitle="Simulated viewer proposals and where each one stands." />
      <section aria-label="All calls" className="surface mt-6 p-5">
        {s.calls.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No calls yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {s.calls.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold">{c.question}</p>
                  <p className="text-sm text-muted-foreground">
                    {supporterCount(c)} supporters · {statusText[c.status]}
                  </p>
                </div>
                {go(c)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function SettingsView({ s }: { s: ReviewSession }) {
  return (
    <>
      <PageHeading title="Settings" subtitle="What this prototype simulates, and how to start over." />
      <section className="surface mt-6 p-5" aria-label="Connection mode">
        <h2 className="text-lg font-bold">Mode: {s.mode === "twitch" ? "Twitch local (experimental)" : "Local demo"}</h2>
        {s.mode === "twitch" && <form className="mt-3 flex gap-2" onSubmit={event => { event.preventDefault(); const form = event.currentTarget; s.setOperatorKey(String(new FormData(form).get("key") ?? "")); form.reset(); }}>
          <label>Local operator key <input type="password" name="key" required autoComplete="off" className="rounded-lg border border-input p-2" /></label><button className="rounded-lg bg-primary px-3 text-white">Unlock this tab</button>
        </form>}
        <p className="mt-2 text-sm text-muted-foreground">The key is kept in this tab's memory. Twitch access tokens remain on the server.</p>
      </section>
      <section aria-labelledby="sim-h" className="surface mt-6 p-5">
        <h2 id="sim-h" className="text-lg font-bold">Simulated in this prototype</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Twitch: there is no connection, sign-in or channel data.</li>
          <li>Viewer proposals and supporters: pseudonymous demo ids, never names.</li>
          <li>The review preview is static. An optional camera captures only a temporary crop in your browser.</li>
          <li>Oracle: a deterministic red-pixel demo; results are uncalibrated and require confirmation.</li>
          <li>Confirmation: your click is the streamer’s confirmation. Nothing is refunded or resolved anywhere.</li>
        </ul>
        <button
          onClick={s.reset}
          className="mt-5 inline-flex items-center gap-2 rounded-lg border border-input bg-card px-4 py-2.5 text-sm font-semibold hover:bg-secondary"
        >
          <RotateCcw className="size-4" aria-hidden /> Refresh local state
        </button>
      </section>
    </>
  );
}









