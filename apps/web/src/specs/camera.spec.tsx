import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Camera } from "@/components/camera";
import type { Call } from "@/lib/review";
const call: Call = { id: 'one', question: 'Red?', rule: 'red', zone: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, eventTime: '', status: 'awaiting_suggestion', supporterIds: [] };
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('requests permission only after the user selects Enable camera and handles rejection', async () => {
  const getUserMedia = vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')); Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  render(<Camera call={call} onCapture={vi.fn()} />); expect(getUserMedia).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Enable camera' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/NotAllowedError/));
  expect(screen.getByRole('button', { name: 'Capture zone' })).toBeDisabled();
});
it('capture failure falls back to UNKNOWN without sending a verdict', async () => {
  const onCapture = vi.fn(); const stop = vi.fn();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ active: true, getTracks: () => [{ stop }], getVideoTracks: () => [{ muted: false, readyState: "live" }] }) } });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  render(<Camera call={call} onCapture={onCapture} />); fireEvent.click(screen.getByRole('button', { name: 'Enable camera' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Capture zone' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Capture zone' }));
  await waitFor(() => expect(onCapture).toHaveBeenCalledWith());
});
it('captures the selected zone into aggregate measurements and preserves capture time', async () => {
  const onCapture = vi.fn(); const stop = vi.fn();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ active: true, getTracks: () => [{ stop }], getVideoTracks: () => [{ muted: false, readyState: "live" }] }) } });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, value: 640 });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, value: 480 });
  const pixels = new Uint8ClampedArray(128 * 128 * 4); for (let i = 0; i < pixels.length; i += 4) { pixels[i] = 220; pixels[i + 1] = 30; pixels[i + 2] = 20; pixels[i + 3] = 255; }
  const drawImage = vi.fn(); vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage, getImageData: () => ({ data: pixels }) } as unknown as CanvasRenderingContext2D);
  Object.defineProperty(crypto, 'subtle', { configurable: true, value: { digest: vi.fn().mockResolvedValue(new Uint8Array(32).buffer) } });
  render(<Camera call={call} onCapture={onCapture} />); fireEvent.click(screen.getByRole('button', { name: 'Enable camera' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Capture zone' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Capture zone' }));
  await waitFor(() => expect(onCapture).toHaveBeenCalled());
  const sample = onCapture.mock.calls[0]![0]; expect(sample.red).toBe(16384); expect(sample.hash).toMatch(/^[a-f0-9]{64}$/); expect(Number.isFinite(Date.parse(sample.capturedAt))).toBe(true);
  expect(drawImage.mock.calls[0]!.slice(1, 5)).toEqual([160, 120, 320, 240]);
});

it('a muted camera produces UNKNOWN instead of an observation', async () => {
  const onCapture = vi.fn();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ active: true, getTracks: () => [{ stop: vi.fn() }], getVideoTracks: () => [{ muted: true, readyState: 'live' }] }) } });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, value: 640 }); Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, value: 480 });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as CanvasRenderingContext2D);
  render(<Camera call={call} onCapture={onCapture} />); fireEvent.click(screen.getByRole('button', { name: 'Enable camera' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Capture zone' })).toBeEnabled()); fireEvent.click(screen.getByRole('button', { name: 'Capture zone' }));
  await waitFor(() => expect(onCapture).toHaveBeenCalledWith());
});
it('releases a camera granted after the component has unmounted', async () => {
  let grant!: (stream: unknown) => void; const stop = vi.fn();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockImplementation(() => new Promise(resolve => { grant = resolve; })) } });
  const view = render(<Camera call={call} onCapture={vi.fn()} />); fireEvent.click(screen.getByRole('button', { name: 'Enable camera' }));
  view.unmount(); grant({ getTracks: () => [{ stop }] }); await waitFor(() => expect(stop).toHaveBeenCalledOnce());
});
it('missing video tracks cannot produce a camera observation', async () => {
  const onCapture = vi.fn(); Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ active: true, getTracks: () => [], getVideoTracks: () => [] }) } });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, value: 640 }); Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, value: 480 });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as CanvasRenderingContext2D);
  render(<Camera call={call} onCapture={onCapture} />); fireEvent.click(screen.getByRole('button', { name: 'Enable camera' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Capture zone' })).toBeEnabled()); fireEvent.click(screen.getByRole('button', { name: 'Capture zone' }));
  await waitFor(() => expect(onCapture).toHaveBeenCalledWith());
});

