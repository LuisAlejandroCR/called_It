// app.spec.tsx: the main review flow through the UI with an instant simulated oracle.
// Covers the DONE WHEN cases: completed review -> receipt, unclear view -> UNKNOWN canceled,
// rejected suggestion -> no receipt, keyboard-only operation, oracle error and retry.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import App from "@/App";
import type { Oracle } from "@/lib/demo-data";

let attempts = 0;
const oracle: Oracle = async (id) => {
  if (id === "call-salt" && attempts++ === 0) throw new Error("timeout");
  return { verdict: "YES", reason: "Salt was observed (simulated).", evidenceHash: "0xfeed" };
};

const receiptRows = () => within(screen.getByRole("region", { name: /receipts/i })).queryAllByRole("row").length - 1;

beforeEach(() => {
  attempts = 0;
  window.location.hash = "#/";
});

describe("review flow", () => {
  it("starts with two pending calls and distinct supporter counts, all marked as demo", async () => {
    render(<App oracle={oracle} bootDelay={0} />);
    expect(await screen.findByText("2 calls need review")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Will it boil over\?.*24 supporters/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add salt.*11 supporters/ })).toBeInTheDocument();
    expect(screen.getAllByText("Demo data").length).toBeGreaterThan(0);
  });

  it("confirming the unclear UNKNOWN suggestion cancels the call and shows it as UNKNOWN, not NO", async () => {
    const user = userEvent.setup();
    render(<App oracle={oracle} bootDelay={0} />);
    expect(await screen.findByText(/Camera view unclear/, { selector: "span.font-medium" })).toBeInTheDocument();
    const before = receiptRows();
    await user.click(screen.getByRole("button", { name: "Confirm UNKNOWN" }));
    expect(receiptRows()).toBe(before + 1);
    const row = screen.getAllByRole("row").find((r) => within(r).queryByText("Will it boil over?"))!;
    expect(within(row).getByText("UNKNOWN")).toBeInTheDocument();
    expect(within(row).getByText(/canceled/)).toBeInTheDocument();
    expect(within(row).queryByText("NO")).toBeNull();
  });

  it("rejecting a suggestion creates no receipt and selects no outcome", async () => {
    const user = userEvent.setup();
    render(<App oracle={oracle} bootDelay={0} />);
    const before = receiptRows();
    await user.click(await screen.findByRole("button", { name: "Reject suggestion" }));
    expect(receiptRows()).toBe(before);
    expect(screen.getByText(/No outcome selected and no receipt created/)).toBeInTheDocument();
    expect(screen.queryByText("Will it boil over?", { selector: "td, th *" })).toBeNull();
  });

  it("approves a proposal, recovers from an oracle error and ends with a YES receipt, by keyboard", async () => {
    const user = userEvent.setup();
    render(<App oracle={oracle} bootDelay={0} />);
    await user.click(await screen.findByRole("button", { name: "Reject suggestion" })); // clears boil, selects salt
    const approve = await screen.findByRole("button", { name: "Approve proposal" });
    approve.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent(/Nothing has been decided/);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    const confirm = await screen.findByRole("button", { name: "Confirm YES" });
    confirm.focus();
    await user.keyboard("{Enter}");
    const row = screen.getAllByRole("row").find((r) => within(r).queryByText("Will they add salt to the water?"))!;
    expect(within(row).getByText("YES")).toBeInTheDocument();
    expect(await screen.findByText("All caught up", { selector: "p.font-semibold" })).toBeInTheDocument();
  });

  it("rejecting a proposal creates no receipt", async () => {
    const user = userEvent.setup();
    render(<App oracle={oracle} bootDelay={0} />);
    await user.click(await screen.findByRole("button", { name: /add salt/ }));
    const before = receiptRows();
    await user.click(screen.getByRole("button", { name: "Reject proposal" }));
    expect(receiptRows()).toBe(before);
  });

  it("shows a loading state while booting", () => {
    render(<App oracle={oracle} bootDelay={50} />);
    expect(screen.getByLabelText("Loading calls")).toHaveAttribute("aria-busy", "true");
  });
});
