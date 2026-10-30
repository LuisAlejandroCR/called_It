import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import App from "@/App";

beforeEach(() => { window.location.hash = "#/"; });
afterEach(() => vi.unstubAllGlobals());
describe("local server UI", () => {
  it("creates a proposal through the API with a normalized zone", async () => {
    const calls: unknown[] = [];
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (!init) return { ok: true, json: async () => ({ calls, receipts: [] }) };
      const body = JSON.parse(String(init.body));
      expect(body.action).toBe("create");
      expect(body.input.zone).toEqual({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
      calls.push({ ...body.input, id: "1", supporterIds: [], status: "proposed", eventTime: "" });
      return { ok: true, json: async () => ({ calls, receipts: [] }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup(); render(<App bootDelay={0} />);
    await screen.findByText("All caught up", { selector: "p.font-semibold" });
    await user.type(screen.getByLabelText("Question"), "Will it boil?");
    await user.clear(screen.getByLabelText("Rule")); await user.type(screen.getByLabelText("Rule"), "Before the timer ends");
    await user.click(screen.getByRole("button", { name: "Create proposal" }));
    expect(await screen.findByText("Proposal created.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve proposal" })).toBeInTheDocument();
  });
  it("reports when the local server is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<App bootDelay={0} />);
    expect(await screen.findByText(/Local server unavailable/)).toBeInTheDocument();
  });
});



it("routes Twitch approval through the operator-key endpoint", async () => {
  const call = { id: 'p', question: 'Red?', rule: 'Rule', zone: { x: 0, y: 0, w: 1, h: 1 }, supporterIds: [], status: 'proposed', eventTime: '' };
  const state = { calls: [call], receipts: [], mode: 'twitch' };
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/state') return { ok: true, json: async () => state };
    expect(url).toBe('/api/twitch'); expect((init?.headers as Record<string, string>)["Authorization"]).toBe('Bearer operator-key');
    expect(JSON.parse(String(init?.body))).toEqual({ action: 'approve', id: 'p' });
    return { ok: true, json: async () => ({ state: { ...state, calls: [{ ...call, status: 'awaiting_suggestion' }] } }) };
  });
  vi.stubGlobal('fetch', fetchMock); window.location.hash = '#/settings'; const user = userEvent.setup(); render(<App bootDelay={0} />);
  await screen.findByText('Mode: Twitch local (experimental)'); await user.type(screen.getByLabelText('Local operator key'), 'operator-key'); await user.click(screen.getByRole('button', { name: 'Unlock this tab' }));
  window.location.hash = '#/'; window.dispatchEvent(new HashChangeEvent('hashchange'));
  await user.click(await screen.findByRole('button', { name: 'Approve proposal' }));
  expect(await screen.findByText('Twitch prediction opened.')).toBeInTheDocument();
});

