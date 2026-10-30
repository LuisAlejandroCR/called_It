import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import App from "@/App";
import { createDemoState } from "@/lib/demo-data";
import { confirmSuggestion, toReceipt } from "@/lib/review";
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

afterEach(() => jest.restoreAllMocks());
it("loads calls from the server and confirms through the server", async () => {
  let state = createDemoState();
  globalThis.fetch = jest.fn(async (_url, init) => {
    if (init?.method === 'POST') {
      const request = JSON.parse(String(init.body));
      expect(request.input).toEqual({ id: 'call-boil' });
      const call = confirmSuggestion(state.calls[0]!); state = { calls: [call, ...state.calls.slice(1)], receipts: [toReceipt(call)!, ...state.receipts] };
    }
    return { ok: true, json: async () => state } as Response;
  }) as jest.Mock;
  await render(<App bootDelay={0} />);
  await screen.findByRole('button', { name: '2 calls need review' });
  await fireEvent.press(screen.getByRole('button', { name: '2 calls need review' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Confirm UNKNOWN' }));
  expect(await screen.findByText('Canceled')).toBeTruthy();
});
it("reports disconnection and retries without inventing calls", async () => {
  globalThis.fetch = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ ok: true, json: async () => createDemoState() });
  await render(<App bootDelay={0} />);
  expect(await screen.findByText(/Connection lost/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: '2 calls need review' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Retry connection' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '2 calls need review' })).toBeTruthy());
});

