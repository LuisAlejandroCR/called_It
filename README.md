# Called It — local camera demo

The server stores calls and receipts in `data/local.json`. The web and Expo client query the same server. Twitch and JEV are not connected. The server is a single-operator demo without authentication; never expose it to an untrusted network.

## Install and run

Requires Node 20+ and npm:

```sh
npm ci --prefix apps/web
npm ci --prefix apps/mobile
npm run verify
npm run verify:web
npm run verify:mobile
npm run local:server
```

In another terminal run `npm --prefix apps/web run dev` and open the URL it prints. The server defaults to loopback. The Expo web client can run with `npm --prefix apps/mobile run web`; it uses `http://127.0.0.1:4174` by default and retries every five seconds after a connection error.

A physical phone or Android emulator cannot use the computer's loopback address. Only on a trusted private network, the operator can explicitly start the server with `CALLED_IT_HOST=0.0.0.0` and set `EXPO_PUBLIC_API_URL` before starting Expo to the computer's reachable address (Android emulator commonly uses `http://10.0.2.2:4174`). This makes an unauthenticated server reachable by other devices on that network; stop it when finished. Native networking, iOS transport restrictions, and device setup have not been verified.

## Camera scenario

Create a proposal with the default rule: `At least 20% of pixels in the selected zone are strongly red.` Enter normalized `x`, `y`, `w`, `h` values in 0–1 and approve. Press **Enable camera**, grant the browser permission yourself, and press **Capture zone**. The browser samples the chosen crop at 128×128, timestamps capture, and sends the pixel count, red count, mean brightness, and SHA-256 hash to the local server. It does not send or persist the image. The server evaluates the metrics: at least 20% strongly red produces a suggested YES; lower signal, unsuitable brightness, missing or invalid evidence produces UNKNOWN. Other rules always produce UNKNOWN. Confirm or reject the suggestion explicitly. UNKNOWN is canceled, not NO.

The browser may require a secure context such as localhost. Camera permission is requested only when enabled; denying it leaves the camera off. Select **Use UNKNOWN without camera** to continue offline. `npm run replay` also works without camera, Twitch, or external services after installation.

This is a narrow uncalibrated color demo. The metrics and timestamp originate in the browser and can be forged; the hash cannot prove what the scene showed. No full frame is stored. No real-world accuracy, production security, automatic resolution, refund, or Twitch behavior is claimed.

## Verification and limits

Node tests cover server validation, persistence, deterministic threshold, and error fallback. Web tests cover consent request and denied/failing camera with mocks, and a simulated local review. Mobile tests cover server responses and reconnect with mocked HTTP. The Expo web client was also checked against the local server: it displayed an existing receipt, showed a stale-data warning when the server stopped, and reconnected after restart. No physical camera, Android or iOS device, screen reader, stream, or Twitch integration was tested in this cycle. Expo web export verifies packaging, not native behavior.


## Twitch preparation (2026-10-29)

The local demo remains the default. `src/twitch/helix.js` validates broadcaster tokens against Twitch and provides isolated Predictions requests; `src/twitch/extension.js` verifies Twitch Extension JWTs and accepts stable logged-in viewer identifiers. `npm run twitch:local` wires these server adapters into a loopback-only harness, but no real channel or Extension deployment was tested.

Documented: [token validation](https://dev.twitch.tv/docs/authentication/validate-tokens/), [Predictions](https://dev.twitch.tv/docs/api/predictions/), [scopes](https://dev.twitch.tv/docs/authentication/scopes/), and [Extension JWT schema](https://dev.twitch.tv/docs/extensions/reference/). `channel:manage:predictions` requires the broadcaster's user token; Twitch reports cancellation as refunding Channel Points. A Twitch Extension JWT is separate from OAuth. Anonymous `A` identifiers are session-specific and cannot establish distinct logged-in viewers, so the adapter rejects them.

Copy `.env.example` to a private environment file and provide values only when configuring an actual Twitch application. The current application does not load this file automatically. Do not place tokens in the browser or commit them. Pending: real Twitch authorization/session handoff, production Extension hosting, multi-process locking, recovery UI, and end-to-end testing with a registered app, Extension, authorized broadcaster and eligible channel. Network timeouts and ambiguous POST/PATCH results must be reconciled against Twitch before retrying, to avoid duplicate or misleading operations.

The Extension adapter now verifies the signed JWT, derives the viewer ID on the server, creates proposals and deduplicates support by stable opaque ID. When `TWITCH_EXTENSION_SECRET_BASE64` is set, `npm run twitch:local` exposes the loopback-only `/api/extension` harness for `propose`, `support`, and `vote`; it rejects caller-provided identities and verdicts. Its tests use locally signed JWTs. It is not a public EBS endpoint: no TLS, production origin policy, abuse limits, or Extension frontend has been deployed. It must not be exposed until those controls and broadcaster authentication are in place.

`src/twitch/oauth.js` implements an isolated authorization-code exchange with expiring one-use state and server-side token validation; credentials live only in memory. A separate loopback callback process is available, but it is not connected to the main Twitch server session; refresh is explicit, rotates tokens, and is not persisted. The Twitch [authorization-code documentation](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/) was consulted on 2026-10-29. The example environment includes a client secret and callback URI, but no credentials should be placed in source control.

`npm run twitch:auth` starts a separate loopback authorization process using `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, and `TWITCH_BROADCASTER_ID` from the environment. Register the exact redirect `http://localhost:4180/callback` in the Twitch application first. Visit the local `/connect` URL to authorize; the process validates the token and retains it only in memory. This standalone authorization is not yet connected to Predictions or the main application. The callback and state were tested with mocked Twitch responses, not a live account.


`src/twitch/coordinator.js` is an experimental transport-neutral coordinator: it requires an approved or confirmed server-side call and records uncertain Twitch operations without blindly retrying. `npm run twitch:local` wires it behind the operator-only loopback route. Its journal must be durable and provide atomic per-call exclusion before production use; reconciliation, recovery from process interruption, OAuth session binding, and concurrent request protection remain unimplemented. Tests use mocks rather than Twitch.

The experimental Predictions journal persists transitions to disk and uses compare-and-set serialization within one process. A leftover `creating` or `closing` state blocks retries and requires manual reconciliation. It does not lock across multiple processes, provide a reconciliation UI, or make the coordinator part of the application; run only one journal owner. Tests cover persistence and concurrent starts with mocks.

`src/twitch/workflow.js` now joins the local service to the experimental coordinator using only server-owned call state; a mocked test covers approval and UNKNOWN cancellation. It is exposed only through the operator-authenticated loopback route. A local confirmation can be saved while Twitch closure is uncertain, so callers must present the journal state separately and reconcile before claiming Twitch cancellation or refund. Session authorization, production hosting, multi-process locking, recovery UI, and a live Twitch test remain required.

The local service also supports a first-vote-per-demo-identity YES/NO vote while a call awaits observation. Votes do not decide the verdict, do not use Twitch Channel Points, and cannot be placed after observation. The transport-neutral Extension adapter can derive the voting identity from a verified JWT; it remains unhosted and untested against Twitch. The web dashboard includes a labeled local voting form with demo identities; it is not connected to Twitch.


`npm run twitch:check` validates an explicitly supplied `TWITCH_USER_ACCESS_TOKEN`, `TWITCH_CLIENT_ID`, and `TWITCH_BROADCASTER_ID` against Twitch without printing the token. The command checks scope and token identity, not channel eligibility or the full integration. Do not paste tokens in chat; set them in a private shell environment. As of this local check the three values are missing.

Experimental `npm run twitch:local` starts a loopback-only server with Twitch adapters and an operator bearer key from `TWITCH_OPERATOR_KEY` (at least 32 characters). The protected `/api/twitch` endpoint accepts only `approve`, `confirm`, or `inspect` and a server-owned call ID. The normal local approval and confirmation endpoints are disabled in this mode. The web UI accepts the local operator key in Settings and retains it only in tab memory; it calls this endpoint for approval and confirmation. Use this only on a trusted local machine. The OAuth process remains separate, so the user token must currently be supplied in the server environment. This is mock-tested, not live-tested; stop other servers using the same files and never bind it to a public interface.

## Chat-first anticipation adapter (experimental)

`src/twitch/anticipations.js` is a separate persistent flow for chat commands: a signed EventSub `channel.chat.message` notification containing `!call <text>` creates a proposal, a server-configured broadcaster/moderator accepts or rejects it, opens participation, closes it before a supplied temporal reference, and confirms `CORRECT`, `INCORRECT`, or `UNCLEAR`. Only one call may be active per channel. A confirmed receipt persists the accepted text, close time, declared result, confirmation time and configured confirmer role. It is explicitly **human-confirmed**; a temporal reference is not claimed to be a clip or proof of who saw an event first. Raw chat text other than the command is ignored; raw chatter IDs are converted to a deterministic pseudonym before persistence and are not returned by the overlay API.

For the local callback harness, set a private `TWITCH_EVENTSUB_SECRET` (10–100 ASCII characters), `TWITCH_BROADCASTER_ID`, and a 32+ character `TWITCH_OPERATOR_KEY`, then run `npm run twitch:chat`. It listens at `127.0.0.1:4181/eventsub` and stores state in `data/anticipations.json`. Twitch webhooks require an HTTPS callback on port 443, so a registered app, a bot/broadcaster authorization, a public TLS reverse proxy, and `TWITCH_EVENTSUB_CALLBACK` are still required before Twitch can invoke it. Use `eventSubSubscription()` with the app access token and the bot's `user_id` to create the `channel.chat.message` subscription. Official Twitch documentation currently states that webhook subscriptions use an app access token; chat message authorization needs `user:read:chat` from the chatting user and, for an app-token bot flow, `user:bot` plus `channel:bot` or moderator status. Request only the scopes actually used. This code verifies the HMAC signature over EventSub ID + timestamp + raw body before JSON parsing, rejects timestamps older than ten minutes or implausibly in the future, deduplicates EventSub IDs, checks both subscription and event channel IDs, records signed revocations, and rate-limits proposals per pseudonymous viewer.

Reproducible pre-live check: run `npm test` for signed challenge, duplicate, stale-timestamp, cross-channel, revocation, restart, concurrency and full HTTP-flow fixtures; then run `npm run twitch:check` in a private shell. It reports only missing/mismatched configuration and never prints a token. After the callback is publicly reachable with TLS, run `npm run twitch:subscribe-chat`; it creates the configured `channel.chat.message` webhook subscription and prints only non-secret subscription metadata. For Twitch CLI validation, use `twitch event verify-subscription subscribe -F https://YOUR_HOST/eventsub -s "$TWITCH_EVENTSUB_SECRET"`; then use a signed `channel.chat.message` fixture from the CLI and observe a proposal through the sanitized overlay endpoint. Do not paste secrets into chat or source control. A production deployment needs durable multi-process coordination or a single server owner; the JSON store serializes requests in one Node process only.

The chat adapter has local tests for signature verification, duplicate events, rate limits, authorization, one-active-call enforcement, immutable closed calls, persistence and `UNCLEAR`. These are simulated EventSub notifications, not a live Twitch test. The current web dashboard remains the separate camera-demo operator surface; it does not display chat calls yet. A production overlay should consume the sanitized `/api/anticipations` state from a TLS-hosted service and never receive the operator key.

