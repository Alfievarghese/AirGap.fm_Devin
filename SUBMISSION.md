# Project submission

## Project

- **Project name:** AirGap.fm
- **Short description:** A zero-infrastructure, browser-native acoustic mesh emergency alert transceiver. Operates over near-ultrasonic and audible FSK sound waves (1.8–6.3 kHz) to relay cryptographically authenticated emergency alerts across smartphones with zero internet, zero cellular towers, and zero Bluetooth. Features custom 1-byte Indic Unicode compression for Malayalam and Hindi (saving 66% airtime), targeted 1-byte unicast device routing with relay suppression, 32-bit HMAC cryptographic verification, and real-time 3D acoustic spectrum visualization.
- **Code repository URL:** https://github.com/AlfieVarghese/AirGap.fm_Devin.git
- **Final submitted implementation commit SHA:** d272607
- **Working demo URL or local demo steps:** Local acoustic transceiver running via `npm run dev` at `http://localhost:5173/`. Dual devices or browser tabs can transmit and receive emergency FSK acoustic chirps across the room.
- **Demo access requirements:** Modern browser (Chrome, Edge, Safari, Firefox) with microphone permissions enabled. No external cloud credentials or API keys needed. Demo authority PIN is `1234`.

## Participants

| Participant name | GitHub handle | Contribution |
| --- | --- | --- |
| Alfie Varghese | @AlfieVarghese | Acoustic mesh protocol, 1-byte Indic compression, targeted routing, audio engine, UI/UX |

## Run and demonstrate

- **Prerequisites and versions:** Node.js v18.0.0+ (Node v20+ recommended), npm v9.0.0+
- **Install command:** `npm install`
- **Required environment variable names:** None (100% self-contained client-side Web Audio & Web Crypto stack).
- **Start command:** `npm run dev`
- **Demo walkthrough:**
  1. Open `http://localhost:5173/` on two separate devices or browser windows.
  2. On Device 1 (Receiver RX): Click **"Start Acoustic Listener"** to arm the microphone. Note your 2-hex Node ID (e.g., `#A4`).
  3. On Device 2 (Sender TX): Enter demo PIN `1234`.
  4. Select **Target Routing**: Choose either `Broadcast (All)` or `Specific Node (#A4)`.
  5. Select an emergency alert (or type Malayalam text like `സഹായം` or `വെള്ളം` in Custom Pager).
  6. Tap **"Broadcast Emergency Beacon"**. Device 2 will emit an acoustic FSK burst (~1.1s).
  7. Device 1 will decode the wave, verify the 32-bit HMAC signature, flash Emerald Green (if broadcast) or Cyan (if direct unicast), and display the translated emergency card.
  8. Switch to **The Wall** tab to view the live 96-bin FSK Spectrogram Waterfall and hop telemetry timeline.
  9. Switch to **Sim** tab and click **"Run Room Mesh Simulation"** to simulate 100 phones relaying acoustic chirps across a physical space.
- **Checks performed and results:**
  - Automated tests: `npx vitest run` — **39 / 39 tests passed** across protocol encoding, 32-bit HMAC, 1-byte Indic compression, and mesh simulation.
  - Production build: `npm run build` — Successful in 129ms; PWA Service Worker precached 9 assets.
- **Known limitations or incomplete features:** Ambient acoustic noise exceeding 85 dB may require retransmission bursts (built-in 3x repeat handles this).
- **Libraries, APIs, and public datasets used:**
  - `ggwave` by Georgi Gerganov / Gerrit Holl ([MIT License](https://github.com/ggerganov/ggwave))
  - `vitest` ([MIT License](https://vitest.dev/))
  - `vite` & `vite-plugin-pwa` ([MIT License](https://vitejs.dev/))
- **AI usage record:** [AI_USAGE.md](AI_USAGE.md)
- **Development change log:** [CHANGELOG.md](CHANGELOG.md)

## Submission checklist

- [x] The project implementation started from scratch at the event.
- [x] I participated solo or with no more than 4 team members in total.
- [x] Codex / Devin was used during development and its usage is documented.
- [x] The code repository URL, short description, and working demo are provided.
- [x] README setup and demo instructions match the submitted code.
- [x] Actual checks and known limitations are documented.
- [x] Meaningful changes are documented and committed throughout development.
- [x] The final implementation is committed and pushed, and its SHA is recorded above.
- [x] No credentials or private data are included in the repository or demo instructions.
- [x] The organizers' announced submission method and timing have been followed.

Event reference: [DevDay Exchange Community: Kochi on Luma](https://luma.com/z10nz8gp). The event wraps up by **10:00 AM IST on 11 October 2026**.
