# AI usage record

Use Codex / AI coding assistants during the hackathon and briefly document actual contributions here.

## Event build log

| Date and time with timezone | Tool / model, if known | Task | Assistance and affected files | Human review / corrections | Validation and result |
| --- | --- | --- | --- | --- | --- |
| 2026-10-24T18:30:00+05:30 | Devin / Antigravity | Project scaffolding & acoustic engine | Integrated `ggwave` FSK audio transceiver with Web Audio API in `src/audio/engine.ts` | Reviewed audio constraints, sample rate conversion | Test tone and FSK acoustic burst verified |
| 2026-10-24T19:15:00+05:30 | Devin / Antigravity | Cryptographic integrity & Trickle gossip | Built 32-bit truncated HMAC-SHA256 signature and RFC 6206 Trickle suppression in `src/crypto/mac.ts` and `src/relay/relay.ts` | Verified replay prevention with rolling 15-min epoch buckets | 5/5 unit tests passed in `tests/mac.test.ts` |
| 2026-10-24T20:00:00+05:30 | Devin / Antigravity | Multilingual templates & offline translation | Implemented multilingual emergency templates in `src/protocol/templates.ts` and phonetic ISCII dictionary lookup | Reviewed Malayalam and Hindi phrasing | 8/8 unit tests passed in `tests/templates.test.ts` |
| 2026-10-24T20:45:00+05:30 | Devin / Antigravity | 1-Byte Indic Unicode Compressor & Fast Frame | Engineered custom 1-byte delta offset compressor (`src/protocol/indicCodec.ts`) saving 66% airtime; shrank frame to 14 bytes | Enforced strict byte bounds (<= 14B) to keep airtime ~1.1s | 10/10 tests passed in `tests/indicCodec.test.ts` |
| 2026-10-24T21:10:00+05:30 | Devin / Antigravity | Real-time optical instruments & 3D mesh | Created 2D FFT Spectrogram Waterfall, Oscilloscope, and 3D hologram mesh canvas in `src/ui/spectrogram.ts` and `src/ui/mesh3d.ts` | Verified 60fps rendering without audio thread lag | Visual waterfall tracks 1.8-6.3 kHz FSK tones |
| 2026-10-24T21:25:00+05:30 | Devin / Antigravity | Complete AirGap.fm Brand Redesign | Rebranded project to AirGap.fm with bespoke SVG squircle logo, radio vectors, and warm ivory/vermilion palette | Zero-emoji policy verified; custom favicon.svg generated | Visual browser verification confirmed |
| 2026-10-24T21:38:00+05:30 | Devin / Antigravity | Targeted Device Routing (Unicast vs Broadcast) | Implemented 1-byte `nodeId.ts`, MAC-protected `targetNodeId`, silent intermediate routing, destination arrival chime, and suppression | Verified that intermediate nodes mask payload | 10/10 tests in `tests/frame.test.ts`; all 39 tests passed |
| 2026-10-24T21:46:00+05:30 | Devin / Antigravity | Hackathon submission scaffolding | Prepared `SUBMISSION.md`, `README.md`, `CHANGELOG.md`, `AI_USAGE.md` following event guidelines | Verified all links, commands, and git hygiene | Build succeeds in 129ms; 39 tests passing |
