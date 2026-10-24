# EchoNet Research Notes

## ggwave

- **npm**: `ggwave` v0.4.2 (MIT license)
- **Max payload**: 140 bytes (uint8 length header). Our 19 byte beacon fits easily.
- **Throughput**: ~8 to 16 bytes/sec depending on protocol.
- **API**: Factory function → `ggwave.init(params)` → `ggwave.encode(inst, payload, protocolId, volume)` → `ggwave.decode(inst, float32AudioBuffer)` → `ggwave.free(inst)`.
- **Protocols** (via `ggwave.ProtocolId`):
  - `GGWAVE_PROTOCOL_AUDIBLE_NORMAL` (robust, slow)
  - `GGWAVE_PROTOCOL_AUDIBLE_FAST` (default for EchoNet)
  - `GGWAVE_PROTOCOL_AUDIBLE_FASTEST` (least robust)
  - `GGWAVE_PROTOCOL_ULTRASOUND_NORMAL/FAST/FASTEST` (OFF by default, phone mics unreliable)
- **WASM**: Bundled inside the npm package. Vite resolves it. Must add `*.wasm` to Workbox globPatterns.
- **Reed Solomon ECC**: Built into ggwave. Reports corrected errors via decode return.
- Source: [ggwave GitHub](https://github.com/ggerganov/ggwave), [npm](https://www.npmjs.com/package/ggwave)

## PWA and WASM Precaching

- `vite-plugin-pwa` with `generateSW` strategy.
- Add `globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm,woff2}']`.
- Set `maximumFileSizeToCacheInBytes: 5 * 1024 * 1024` (ggwave WASM ~2MB).
- `registerType: 'autoUpdate'` with versioned cache names.
- Source: [vite-plugin-pwa docs](https://vite-pwa-org.netlify.app/)

## iOS Safari Audio

- **Ringer/silent switch** mutes Web Audio (AudioContext). HTML `<audio>` uses the media channel and bypasses it.
- **Workaround**: On first user tap, play a tiny silent looping `<audio>` element. This forces iOS into media playback mode, which lets Web Audio through.
- **Modern**: `navigator.audioSession.type = 'playback'` (limited support, use as enhancement).
- **Autoplay**: AudioContext MUST be created/resumed inside a user gesture handler.
- **Sample rate**: iOS Safari often forces 44100 Hz. Read `audioContext.sampleRate` after creation and pass it to ggwave.
- Source: [WebKit blog](https://webkit.org/blog/), [MDN AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext)

## Screen Wake Lock

- Native `navigator.wakeLock.request('screen')` widely supported (Chrome, Safari, Edge, Firefox).
- No NoSleep.js needed. Simple try/catch fallback.
- Must re-acquire on `visibilitychange` when page returns to foreground.
- Source: [MDN Wake Lock](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API)

## AudioWorklet vs ScriptProcessor

- **AudioWorklet**: Modern, runs in a separate thread, better performance. Supported on Chrome Android 66+, Safari 14.5+.
- **ScriptProcessorNode**: Deprecated but works everywhere. Use as fallback for older WebViews.
- Detection: `if (typeof AudioWorkletNode !== 'undefined')`.
- For 3 to 5 year old Android phones (Chrome 80+), AudioWorklet is available.
- Source: [MDN AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)

## Existing ggwave Relay Projects

- **None found**. ggwave ecosystem has point to point demos (wave-share, PairSonic for key exchange).
- Academic: GUWMANET (air coupled acoustic mesh) is research only, not ggwave based.
- **EchoNet is novel**: first ggwave based multi hop relay PWA. Pitch this honestly.
- ESP32 based acoustic beacons exist but are hardware projects, not browser PWAs.
- Source: [ggwave examples](https://github.com/ggerganov/ggwave/tree/master/examples)

## Realistic Range and Error Rates

- Audible protocols: 1 to 5 metres reliable in quiet rooms, degrades with noise.
- AUDIBLE_FAST: ~3m reliable, ~5m marginal.
- AUDIBLE_NORMAL: more robust, ~5m, slower.
- AUDIBLE_FASTEST: ~1 to 2m, fast but fragile.
- Noise floors in event halls: expect degradation. Must test in venue.
- Source: ggwave GitHub issues and examples

## Microphone Constraints

- Request: `{ echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 }`
- Browsers may ignore these. Verify with `track.getSettings()` and warn in Lab.
- In app browsers (WhatsApp, Instagram) often block mic. Detect and show "Open in Chrome/Safari".

## Fonts for Offline

- Bundle Noto Sans subsets (woff2) for Latin, Malayalam (ml), Hindi/Devanagari (hi).
- Google Fonts API can generate subsets. Download and bundle in /public/fonts.
- Verify rendering on old Android.
