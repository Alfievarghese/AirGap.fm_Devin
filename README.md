# EchoNet 📡🔊

> *"The telephone game that never loses the message."*

**EchoNet** is an offline-first Progressive Web App (PWA) that enables smartphones to relay critical emergency alerts across a room using **sound waves alone**. It requires **no Internet, no Wi-Fi, no Bluetooth, and no app store installation** beyond opening a link cached previously in the browser.

When cellular towers, power grids, and internet backbones fail during floods, landslides, or cyclones, sound still crosses a room. EchoNet turns consumer smartphones into an ad-hoc acoustic emergency relay.

---

## ⚡ Key Highlights & Live Demo Proofs

- **100% Offline After First Load**: ServiceWorker precaches the application, WebAssembly runtime, fonts, and icons. Operates completely in **Airplane Mode**.
- **Data-over-Sound (WASM)**: Powered by `ggwave` FSK audio modulation via the Web Audio API. Transmits robust 19-byte compact beacon packets at ~16 bytes/second.
- **Multilingual Emergency Alerts**: Template-indexed payloads render instantly in **English**, **മലയാളം (Malayalam)**, and **हिन्दी (Hindi)**.
- **Tamper-Evident HMAC Verification**: Truncated HMAC-SHA256 MAC verifies packet authenticity across hops before relaying.
- **Acoustic Collision Avoidance (CSMA/CA)**: Carrier sense, randomized backoff jitter (200–500ms), and time-bucket deduplication prevent acoustic storm collisions.
- **Live Projector Wall & Room Race**: Fullscreen Wall mode measures end-to-end multi-hop propagation time and hop count live on a projector.
- **Interactive Room Simulator**: Visual 50-node synthetic room simulator modeling coverage, hop depth, and packet loss.

---

## 🏗 System Architecture

```
┌────────────────────────────────────────────────────────┐
│             UI / Presentation Layer                     │
│  Listener  │  Authority  │  The Wall  │  Lab  │  Sim   │
└────────────────────────────────────────────────────────┘
                           │
┌────────────────────────────────────────────────────────┐
│             Relay & Protocol Layer                     │
│  - 19-Byte Packed Binary Frame                         │
│  - Time-Bucket Deduplication (60s window)              │
│  - Jittered Backoff CSMA/CA Retransmit (TTL decrement) │
│  - HMAC-SHA256 Truncated 8-byte Integrity Tag          │
└────────────────────────────────────────────────────────┘
                           │
┌────────────────────────────────────────────────────────┐
│             Audio Engine & DSP Layer                   │
│  - Web Audio API (AudioContext + AnalyserNode)         │
│  - ggwave WebAssembly Modem (FSK Modulation)           │
│  - iOS Silent Loop & AudioSession Unlock               │
│  - Screen Wake Lock API (prevents mobile sleep)        │
└────────────────────────────────────────────────────────┘
```

### 19-Byte Beacon Frame Structure

| Byte Offset | Field | Size | Description |
|---|---|---|---|
| `0x00` | `version` | 4 bits | Protocol version (`0x01`) |
| `0x00` | `type` | 4 bits | Frame Type (`0x01` = Beacon) |
| `0x01 - 0x02` | `alertId` | 16 bits | Unique alert identifier |
| `0x03` | `templateId` | 8 bits | Preset emergency template code |
| `0x04` | `regionCode` | 8 bits | Target geographic region |
| `0x05 - 0x07` | `params` | 24 bits | Parametric arguments (severity, coords) |
| `0x08` | `originTimeBucket` | 8 bits | 60-second origin bucket |
| `0x09` | `hop` | 8 bits | Current hop count (incremented on relay) |
| `0x0a` | `ttl` | 8 bits | Time-To-Live remaining (decremented on relay) |
| `0x0b - 0x12` | `mac` | 64 bits | Truncated HMAC-SHA256 over bytes 0x00–0x08 |

---

## ⚠️ Honest Acoustic Limits & Physical Constraints

EchoNet is engineered for **room-scale proof-of-concept relays** (3 to 6 hops across a room or shelter). We make no false claims about city-scale audio meshes:

1. **Acoustic Range**: Reliable point-to-point transmission is **1 to 4 meters** in standard indoor rooms. Transmission degrades sharply past 5 meters due to inverse-square sound decay.
2. **Environmental Noise Floor**: Loud ambient environments (screaming, rock concerts, industrial machinery) will increase packet error rates. The audible fast protocol operates around 1.5–3.5 kHz where phone speakers and mics have optimal sensitivity.
3. **Half-Duplex Nature**: A phone cannot reliably receive audio while its own speaker is blasting a transmission. The engine enforces an explicit `LISTEN → TX → COOLDOWN → LISTEN` half-duplex state machine.
4. **Bandwidth Ceiling**: Transmission rate is ~16 bytes per second. EchoNet is strictly for short alerts (19-byte beacons), **not** arbitrary voice or text chat.
5. **Security Model**: The demo version uses a preshared demo HMAC key (`0xec0e...`). Production deployment would require public-key Ed25519 signatures, adding ~32–64 bytes to frame transmission time.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Chrome / Safari / Edge browser (microphone permission required)

### Local Development

```bash
# 1. Install dependencies
npm install

# 2. Run test suite
npm test

# 3. Start local development server with LAN host exposure
npm run dev -- --host
```

Open the displayed Network URL (e.g. `http://192.168.1.X:5173`) on 2 or more phones connected to the same local network, or access the deployed PWA URL.

### Production Build

```bash
npm run build
npm run preview
```

---

## 📱 Supported Mobile Devices

- **Android**: Chrome 80+, Firefox 90+, Samsung Internet (Full AudioContext & WakeLock support).
- **iOS / iPadOS**: Safari 14.5+ (Requires tapping screen to unlock Web Audio; includes silent audio fallback to bypass hardware ringer mute switch).
