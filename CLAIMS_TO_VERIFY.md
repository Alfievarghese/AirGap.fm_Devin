# Claims to Verify

This file records every claim from earlier drafts or discussions that cannot be proven directly from code in `src/` or from physical test logs. Nothing in this file should appear in `README.md` as a verified fact until physical test data confirms it.

---

## 1. Acoustic Range and Wall Penetration

- **Claim:** Reliable acoustic transmission range of 8 to 15 meters per hop.
- **Claim:** Penetrates drywall and concrete corridors.
- **Code reality:** The software emits and records audio via `ggwave` through Web Audio. Range depends entirely on phone speaker volume, microphone gain, room echo, and ambient noise.
- **Status:** Unverified. Needs physical multi room acoustic decibel measurements.

---

## 2. Battery Consumption

- **Claim:** Battery impact is under 2 percent per hour of idle listening.
- **Code reality:** The application keeps the microphone open and runs an AudioWorklet or Web Audio processor continuously to feed audio buffers into the demodulator. No battery discharge benchmarks have been run on real iOS or Android devices.
- **Status:** Unverified. Needs hardware battery profiling over several hours.

---

## 3. Replay Protection via 15 Minute Epoch

- **Claim:** Rolling 15 minute epoch buckets protect against acoustic replay attacks.
- **Code reality:** While helper functions `getTimeBucket` and `isExpired` exist in `src/protocol/frame.ts`, the actual 14 byte wire frame has no timestamp field. The wire bytes are Version and Type (1B), Target ID (1B), Alert ID (2B), Payload (5B), Hop and TTL (1B), and MAC (4B). Deduplication only checks Alert ID plus MAC in local memory.
- **Status:** Wire protocol does not contain timestamps. Replay protection is limited to in memory deduplication of seen packets.

---

## 4. Acoustic Band Classification

- **Claim:** Frequencies from 4.5 kHz to 6.3 kHz are near ultrasonic.
- **Physical reality:** Human hearing range extends up to approximately 15 kHz to 20 kHz. The band from 1.8 kHz to 6.3 kHz is completely audible to human ears.
- **Status:** Corrected. All frequencies used by `ggwave` audible modes are audible sound.

---

## 5. Security and Privacy

- **Claim:** Zero panic spoofing and tamper proof civil defense security.
- **Claim:** Decrypted messages and victim privacy on intermediate nodes.
- **Code reality:** The HMAC secret key `AIRGAP_SHARED_SECRET_2026` is stored directly in client JavaScript in `src/crypto/mac.ts`. Anyone with browser developer tools can inspect the key and craft signed packets. Furthermore, payload bytes are broadcast in plain text without encryption. The intermediate node UI masks the card in its display, but the acoustic wave itself is unencrypted.
- **Status:** Corrected. Packets are authenticated with a shared demo key, not encrypted.
