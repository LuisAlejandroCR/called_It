import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createService } from "../../../../src/local/service.js";
import App from "@/App";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("web with persistent local service", () => {
  it("creates, supports, approves and confirms UNKNOWN across a reload", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "called-it-ui-"));
    try {
      const file = path.join(dir, "state.json");
      let service = createService(file); await service.load();
      vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
        if (!init) return { ok: true, json: async () => service.snapshot() };
        const { action, input } = JSON.parse(String(init.body));
        try { const state = await service.dispatch(action, input); return { ok: true, json: async () => state }; }
        catch (error) { return { ok: false, json: async () => ({ error: String(error) }) }; }
      }));
      window.location.hash = "#/"; const user = userEvent.setup(); render(<App bootDelay={0} />);
      await screen.findByText("All caught up", { selector: "p.font-semibold" });
      await user.type(screen.getByLabelText("Question"), "Will it boil?");
      await user.clear(screen.getByLabelText("Rule")); await user.type(screen.getByLabelText("Rule"), "Before the timer");
      await user.click(screen.getByRole("button", { name: "Create proposal" }));
      await screen.findByRole("button", { name: "Approve proposal" });
      for (const [id, count] of [["a", 1], ["a", 1], ["b", 2]] as const) { await user.clear(screen.getByLabelText("Demo viewer ID")); await user.type(screen.getByLabelText("Demo viewer ID"), id); await user.click(screen.getByRole("button", { name: "Support" })); await waitFor(() => expect(service.snapshot().calls[0]?.supporterIds.length).toBe(count)); }
      expect(await screen.findByText("2 supporters", { selector: "p" })).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Approve proposal" }));
      await user.type(await screen.findByLabelText("Demo voter ID"), "voter-a"); await user.click(screen.getByRole("button", { name: "Submit local vote" }));
      await screen.findByText(/Local vote recorded/); expect(screen.getByText(/YES: 1/)).toBeInTheDocument();
      await user.click(await screen.findByRole("button", { name: "Use UNKNOWN without camera" }));
      await user.click(await screen.findByRole("button", { name: "Confirm UNKNOWN" }));
      expect(await screen.findByText(/Confirmed\. Receipt saved locally/)).toBeInTheDocument();
      cleanup(); service = createService(file); await service.load(); render(<App bootDelay={0} />);
      expect(await screen.findByText("UNKNOWN")).toBeInTheDocument();
      expect(screen.getByText(/canceled/)).toBeInTheDocument();
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});






