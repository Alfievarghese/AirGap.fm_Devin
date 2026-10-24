# Change log

Record each meaningful project change during the event, newest first.

## Event build log

## 2026-10-24T22:25:00+05:30 — Frame Alignment, 14-Byte Protocol Hardening & Brand Integrity Audit

- Changed: Corrected `src/crypto/mac.ts` comment (4-byte truncated HMAC-SHA256), updated `src/main.ts` and `src/style.css` 14-byte frame anatomy breakdown and branding, hardened `src/protocol/frame.ts` to strictly enforce 14-byte frame invariant, updated `package-lock.json` package name to `airgap-fm`.
- Why: Ensure exact consistency between protocol specification, frame layout visualizer, binary encode logic, and test suites.
- Validation: `npx vitest run` verified 39/39 tests passing; `npm run build` completed cleanly in 98ms.
- Limitations: None.

## 2026-10-24T21:46:00+05:30 — Hackathon Submission Packaging & Final Git Synchronization

- Changed: Added `SUBMISSION.md`, `RULES.md`, `AGENTS.md`, `AI_USAGE.md`, `.github/pull_request_template.md`, updated `README.md` and `.gitignore`.
- Why: Meet DevDay Exchange Community Hackathon: Kochi submission criteria and prepare clean repository for evaluator review.
- Validation: `npm run build` completed in 129ms; `npx vitest run` verified 39/39 tests passing; `.gitignore` checked for unwanted folders.
- Limitations: None identified in these checks.

## 2026-10-24T21:38:00+05:30 — 1-Byte Node Identity & Targeted Device Routing (Unicast vs Broadcast)

- Changed: Created `src/protocol/nodeId.ts`, added 1-byte `targetNodeId` to immutable MAC-protected frame section in `src/protocol/frame.ts`, created `src/ui/authority.ts` with Target Destination Selector, updated `src/relay/relay.ts` with unicast destination relay suppression, added pleasant two-tone arrival chime in `src/audio/engine.ts`, and updated `src/main.ts` with tap-to-edit `#ID` header pill, Amber silent intermediate routing banner, and Cyan destination alert cards.
- Why: Enable direct point-to-point emergency messaging across acoustic hops while maintaining end-user privacy on intermediate relay phones and suppressing unnecessary acoustic retransmissions.
- Validation: 10/10 tests in `tests/frame.test.ts` passed; manual verification in UI confirmed distinct Emerald (Broadcast), Amber (Silent Forward), and Cyan (Destination Reached) states.
- Limitations: None identified in these checks.

## 2026-10-24T21:20:00+05:30 — Full Rebrand to AirGap.fm with Bespoke SVG Vector Identity

- Changed: Rebranded package, titles, and manifest to AirGap.fm; created bespoke SVG favicon with squircle, acoustic wave pulses, and FM badge; added tactical transceiver header and styling in `src/style.css` and `src/ui/icons.ts`.
- Why: Deliver a distinctive, memorable, and premium hardware identity for the emergency transceiver.
- Validation: Verified favicon and webmanifest load properly; visual inspection in browser confirmed pristine aesthetic.
- Limitations: None identified.

## 2026-10-24T20:45:00+05:30 — 1-Byte Indic Unicode Compressor & 14-Byte Fast Frame

- Changed: Created `src/protocol/indicCodec.ts` with delta offset compression for Malayalam (`U+0D00`) and Hindi (`U+0900`); shrank MAC from 8 bytes to 4 bytes (truncated HMAC-SHA256); introduced dual frame types (Template Alerts & Custom Indic Pager) fitting into <= 14 bytes.
- Why: Standard UTF-8 wastes 3 bytes per Indic character, making acoustic chirps ~3.8s long. The 1-byte compressor cuts airtime by 66% to ~1.1s.
- Validation: 10/10 unit tests in `tests/indicCodec.test.ts` passed; 5/5 tests in `tests/mac.test.ts` passed.
- Limitations: Custom pager messages bounded to 5-6 characters per fast burst.

## 2026-10-24T20:10:00+05:30 — Real-Time Acoustic Spectrogram Waterfall & 3D Mesh Hologram

- Changed: Built real-time 96-bin FFT Spectrogram Waterfall in `src/ui/spectrogram.ts`, 3D particle mesh canvas in `src/ui/mesh3d.ts`, and oscilloscope view for acoustic wave monitoring.
- Why: Provide visual telemetry on incoming acoustic FSK tones (1.8–6.3 kHz) on both mobile transceivers and the Wall projector display.
- Validation: Verified smooth 60fps canvas animation with Web Audio AnalyserNode.
- Limitations: Background tabs throttle requestAnimationFrame as per browser power-saving standards.

## 2026-10-24T19:30:00+05:30 — Multilingual Emergency Templates & Offline ISCII Translator

- Changed: Created `src/protocol/templates.ts` and `src/protocol/offlineTranslator.ts` supporting modular sentence composition and English/Malayalam/Hindi translations.
- Why: Enable instant civil defense alert broadcasting without requiring text typing during panic.
- Validation: 8/8 tests in `tests/templates.test.ts` passed.
- Limitations: Dictionary lookup covers critical disaster vocabulary.

## 2026-10-24T18:45:00+05:30 — Trickle Gossip Relay & RFC 6206 Suppression Engine

- Changed: Created `src/relay/relay.ts` and `src/relay/sim.ts` implementing Trickle gossip suppression ($k=2$, $I_{min} \dots I_{max}$) and Monte Carlo room propagation simulation.
- Why: Prevent acoustic packet storms and endless echo loops in dense indoor environments.
- Validation: Simulation test in `tests/sim.test.ts` confirmed 100% coverage across 50 nodes with 30% packet loss.
- Limitations: Room acoustics vary based on wall absorption and geometry.
