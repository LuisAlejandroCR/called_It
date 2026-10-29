// app.spec.tsx: navigation, review transitions (including UNKNOWN), rejection and touch targets,
// driven through the rendered UI with an instant simulated oracle.
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import App from "@/App";
import type { Oracle } from "@/lib/demo-data";

jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

let attempts = 0;
const oracle: Oracle = async (id) => {
  if (id === "call-salt" && attempts++ === 0) throw new Error("timeout");
  return { verdict: "YES", reason: "Salt was observed (simulated).", evidenceHash: "0xfeed" };
};

const open = async () => { await render(<App oracle={oracle} bootDelay={0} />); };
const press = async (name: string | RegExp) => { await fireEvent.press(screen.getByRole("button", { name })); };
const tab = async (name: string) => { await fireEvent.press(screen.getByRole("tab", { name })); };

beforeEach(() => {
  attempts = 0;
});

describe("navigation", () => {
  it("shows the pending count and concise cards on Home, all labeled as demo data", async () => {
    await open();
    expect(screen.getByRole("button", { name: "2 calls need review" })).toBeTruthy();
    expect(screen.getAllByText(/24 supporters/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Demo data").length).toBeGreaterThan(0);
  });

  it("navigates Home -> Review -> back and across the three tabs", async () => {
    await open();
    await press(/2 calls need review/);
    expect(await screen.findByText("Review call")).toBeTruthy();
    await press("Back");
    expect(await screen.findByText(/Good (morning|afternoon|evening), Alex/)).toBeTruthy();
    await tab("Calls");
    expect(screen.getByText("Simulated viewer proposals and where each one stands.")).toBeTruthy();
    await tab("Receipts");
    expect(screen.getByText("A record of outcomes you confirmed.")).toBeTruthy();
    await tab("Home");
    expect(screen.getByText("Pending calls")).toBeTruthy();
  });

  it("shows a loading state while booting", async () => {
    await render(<App oracle={oracle} bootDelay={50} />);
    expect(screen.getByLabelText("Loading calls")).toBeTruthy();
  });
});

describe("review flow", () => {
  it("confirming the unclear UNKNOWN suggestion cancels the call and the receipt says UNKNOWN, not NO", async () => {
    await open();
    await press(/2 calls need review/);
    expect((await screen.findAllByText("Camera view unclear")).length).toBeGreaterThan(0);
    expect(screen.getByText(/Confirming UNKNOWN cancels the call. It is not treated as NO./)).toBeTruthy();
    await press("Confirm UNKNOWN");
    // Lands on the receipt detail.
    expect(await screen.findByText("Canceled")).toBeTruthy();
    expect(screen.getAllByText("UNKNOWN").length).toBeGreaterThan(0);
    expect(screen.queryByText("NO")).toBeNull();
    expect(screen.getByText(/no result is counted/)).toBeTruthy();
    expect(screen.getByText("Rule")).toBeTruthy();
    expect(screen.getByText("Evidence hash")).toBeTruthy();
    expect(screen.getByText("Not available")).toBeTruthy();
    // And it is now in the list, canceled.
    await press("Back");
    await tab("Receipts");
    expect(screen.getByRole("button", { name: /Will it boil over\?, UNKNOWN, canceled/ })).toBeTruthy();
  });

  it("rejecting a suggestion creates no receipt and picks no outcome", async () => {
    await open();
    await tab("Receipts");
    const before = screen.getAllByRole("button", { name: /Opens the receipt|, / }).length;
    await tab("Home");
    await press(/2 calls need review/);
    await press("Reject suggestion");
    expect(await screen.findByText(/No outcome selected and no receipt created/)).toBeTruthy();
    await tab("Receipts");
    expect(screen.queryByRole("button", { name: /Will it boil over\?/ })).toBeNull();
    expect(screen.getAllByRole("button", { name: /Opens the receipt|, / }).length).toBe(before);
    // The rejected call is no longer pending but has no outcome either.
    await tab("Calls");
    expect(screen.getByText(/Suggestion rejected · no outcome/)).toBeTruthy();
  });

  it("approves a proposal, recovers from an oracle error and ends with a YES receipt", async () => {
    await open();
    await tab("Calls");
    await press(/add salt to the water/);
    await press("Approve proposal");
    expect(await screen.findByText("Couldn’t get a suggestion")).toBeTruthy();
    expect(screen.getByText(/Nothing has been decided/)).toBeTruthy();
    await press("Try again");
    await press("Confirm YES");
    expect(await screen.findByText("Confirmed")).toBeTruthy();
    expect(screen.getByText("0xfeed")).toBeTruthy();
  });

  it("rejecting a proposal creates no receipt", async () => {
    await open();
    await tab("Calls");
    await press(/add salt to the water/);
    await press("Reject proposal");
    expect(await screen.findByText(/Proposal rejected: “.*No receipt was created/)).toBeTruthy();
    await tab("Receipts");
    expect(screen.queryByRole("button", { name: /add salt/ })).toBeNull();
  });

  it("filters receipts by outcome and shows an empty state when nothing matches", async () => {
    await open();
    await tab("Receipts");
    await fireEvent.press(screen.getByRole("tab", { name: "No" }));
    expect(screen.getByText("No receipts match")).toBeTruthy();
    await fireEvent.press(screen.getByRole("tab", { name: "Yes" }));
    expect(screen.getAllByRole("button", { name: /YES/ }).length).toBe(2);
  });

  it("an empty queue shows the all-caught-up state", async () => {
    await open();
    await press(/2 calls need review/);
    await press("Reject suggestion");
    await waitFor(() => expect(screen.getByRole("button", { name: /1 call needs review/ })).toBeTruthy());
    await press(/1 call needs review/);
    await press("Reject proposal");
    expect((await screen.findAllByText("All caught up")).length).toBeGreaterThan(0);
  });
});

describe("touch targets and accessibility", () => {
  const MIN = 44;
  const size = (el: Parameters<typeof StyleSheet.flatten>[0]) => {
    const st = StyleSheet.flatten(el) ?? {};
    return { h: Number(st.minHeight ?? st.height ?? 0), w: Number(st.minWidth ?? st.width ?? 0) };
  };

  it("every button and tab on Home is at least 44 dp tall", async () => {
    await open();
    for (const el of [...screen.getAllByRole("button"), ...screen.getAllByRole("tab")]) {
      expect(size(el.props.style).h).toBeGreaterThanOrEqual(MIN);
    }
  });

  it("every button on Review and Receipt detail is at least 44 dp and has an accessible name", async () => {
    await open();
    await press(/2 calls need review/);
    for (const el of screen.getAllByRole("button")) {
      expect(size(el.props.style).h).toBeGreaterThanOrEqual(MIN);
      expect(el.props.accessibilityLabel).toBeTruthy();
    }
    await press("Confirm UNKNOWN");
    await screen.findByText("Canceled");
    for (const el of screen.getAllByRole("button")) expect(size(el.props.style).h).toBeGreaterThanOrEqual(MIN);
  });

  it("marks headings and exposes the selected tab to screen readers", async () => {
    await open();
    expect(screen.getAllByRole("header").length).toBeGreaterThan(1);
    expect(screen.getByRole("tab", { name: "Home", selected: true })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Receipts", selected: false })).toBeTruthy();
  });
});
