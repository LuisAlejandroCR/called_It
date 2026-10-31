import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, expect, it, afterEach } from "vitest";
import { ChatAnticipations } from "@/components/chat-anticipations";

afterEach(() => vi.unstubAllGlobals());
describe("chat anticipation panel", () => {
  it("shows signed-chat proposals and sends no caller-selected role", async () => {
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === "/api/anticipations" && !options) return new Response(JSON.stringify({ proposals: [{ id: "one", channelId: "channel", text: "boss falls", status: "proposed", proposedAt: "now" }], receipts: [] }));
      return new Response(JSON.stringify({ id: "one", status: "accepted" }));
    }); vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup(); render(<ChatAnticipations />); await screen.findByText("boss falls");
    await user.type(screen.getByLabelText("Local operator key"), "a".repeat(32)); await user.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/anticipations/action", expect.objectContaining({ body: JSON.stringify({ id: "one", action: "accept" }) })));
  });
});
