# Mobile local client

Install with `npm ci --prefix apps/mobile` and run `npm --prefix apps/mobile start` or `npm --prefix apps/mobile run web`. It polls the local server and shows a disconnected/stale warning, then retries. See the root README for API URL and trusted-network setup. The server has no authentication and is not suitable for public networks.

The review preview is a static placeholder. Camera capture happens in the web app; mobile can review the resulting suggestion or choose the no-camera UNKNOWN fallback. Typecheck and Jest HTTP mocks passed. Expo web was also checked against the local server for persisted receipts, disconnect, and reconnect. No Android or iOS device was tested.

