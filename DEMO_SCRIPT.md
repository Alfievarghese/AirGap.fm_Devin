# EchoNet 90-Second Demo Script & Judge Q&A Defense

> Spoken presentation script tailored for Devin Hacks Kochi judges, followed by technical defenses for anticipated scrutiny.

---

## 🎙 90-Second Spoken Pitch & Live Demo Script

*(Total Duration: 85–90 seconds)*

### [00:00 - 00:20] The Problem & The Constraint
> "Judges, in 2024, catastrophic landslides in Wayanad tore down cellular towers, power grids, and fiber lines in under 10 minutes. When people were trapped in dark shelters, they had smartphones in their pockets—but zero connectivity. No internet. No mobile networks.
> 
> "What didn't die? The speakers and microphones on those phones. And the air between them."

### [00:20 - 00:40] The Demonstration Begins
> "This is **EchoNet**: the telephone game that never loses the message.
> 
> *(Presenter holds up Authority phone)*
> 
> "Every phone you see on this stage has **Airplane Mode switched ON**, and **Wi-Fi and Bluetooth disabled**. There is no socket connection. There is no radio link.
> 
> "I am logged in as Civil Authority on Phone A. I am selecting an emergency drill: *'Flood warning. Move to higher ground.'* Watch the Wall projector behind me as I broadcast."

### [00:40 - 01:05] The Multi-Hop Acoustic Ripple
> *(Presenter taps Broadcast. Audible chirp sounds from Phone A)*
> 
> *(1.2 seconds later: Phone B in the center chirps and its screen lights up in crimson)*
> 
> "Phone A just transmitted a cryptographically signed 19-byte acoustic beacon. Phone B in the middle of the room heard it, verified the 8-byte HMAC integrity tag, displayed the alert in Malayalam, and relayed it forward with a randomized collision-avoidance backoff."

### [01:05 - 01:25] The Climax on the Wall
> *(The Wall projector flashes: RACE TIME 2.74s, HOP 2, ALERT 0xA4F1)*
> 
> "And right now, on the projector Wall: **Hop 2 received in 2.74 seconds**.
> 
> "The message crossed this entire room, hop by hop, phone to phone, with no app store install, no radio frequencies, and zero external infrastructure."

### [01:25 - 01:30] The Closer
> "EchoNet turns ordinary web browsers into emergency acoustic lifelines when everything else goes dark. Thank you."

---

## 🛡 Tough Technical Defense Q&A

### Q1: "Why not Bluetooth Low Energy (BLE) or Wi-Fi Direct mesh?"
**Answer:**
1. **Zero App Store Requirement**: BLE mesh and Wi-Fi Direct require native iOS/Android permissions, dedicated APK installations, or OS-level pairing negotiations. In a sudden disaster, victims cannot download a 40MB native app from an app store because towers are already dead. EchoNet is a Progressive Web App: open a link once, or receive it cached via local hotspot, and it runs immediately in any browser sandbox.
2. **Cross-Platform BLE Fragmentation**: BLE advertising in background and mesh synchronization between iOS and Android is notoriously flaky and restricted by Apple's CoreBluetooth sandboxing. Web Audio and microphones work identically on iOS Safari and Android Chrome without pairing protocols.
3. **No Hardware Pairing / Discovery Delay**: BLE pairing requires inquiry scans, address handshakes, and GATT service discovery (often taking 5–15 seconds per connection). Acoustic FSK broadcast is instant broadcast to everyone within earshot simultaneously.

---

### Q2: "Can it be faked or spoofed by malicious actors in the room?"
**Answer:**
1. **Cryptographic HMAC Tag**: Every 19-byte beacon includes an 8-byte truncated HMAC-SHA256 signature calculated over immutable frame fields (alert ID, template ID, region code, origin timestamp). 
2. **Hop Verification**: When a relaying phone hears a packet, it re-computes the HMAC. If the payload has been tampered with or fabricated without the civil protection signing key, the frame is silently dropped and never forwarded.
3. **Replay Attack Resistance**: Frames carry an `originTimeBucket` (60-second quantization). Old or replayed packets from previous hours or days are discarded by the deduplication sliding window.
4. **Honest Hackathon Note**: For this 12-hour demo, we use a pre-shared demonstration key. In production, this upgrades to an Ed25519 public-key signature infrastructure.

---

### Q3: "What about ambient noise in real disaster shelters or rainstorms?"
**Answer:**
1. **FSK Modulation & Reed-Solomon ECC**: `ggwave` uses Multiple Frequency-Shift Keying (MFSK) with built-in Reed-Solomon forward error correction. If background noise corrupts several frequency bins, the Reed-Solomon decoder reconstructs the missing bytes without packet retransmission.
2. **Frequency Allocation**: The audible fast protocol operates between **1.5 kHz and 3.5 kHz**. This band sits comfortably above low-frequency room rumbles (air conditioners, footfalls, rain on roofs at <500 Hz) and below high-frequency machine screeches.
3. **Fallback Modes**: If noise levels exceed 75 dBA, EchoNet can drop into `AUDIBLE_NORMAL` mode, which doubles tone duration and increases SNR margin by ~6 dB.

---

### Q4: "Why audible sound instead of inaudible ultrasound?"
**Answer:**
1. **Hardware Reliability**: Ultrasound (>18 kHz) sounds cool in theory, but smartphone microphones and consumer speakers have aggressive low-pass anti-aliasing filters. On budget phones, ultrasound packet loss exceeds 55% even at 1 meter.
2. **Psychological Confirmation**: In a real disaster drill or emergency evacuation, hearing the acoustic alert chirp provides immediate sensory confirmation that an emergency beacon is actively echoing across the room.
3. **Volume Safety**: The audible chirp is brief (~1.2 seconds) and pleasant (harmonic chord-like tones), not an ear-splitting alarm tone.

---

### Q5: "How does this scale in a packed room without packet collisions?"
**Answer:**
1. **Acoustic CSMA/CA**: Before relaying, each phone enforces a carrier sense check and applies a **randomized backoff jitter between 200ms and 500ms**.
2. **Time-Bucket Deduplication**: Once a phone hears alert `0xA4F1` from any neighbor, it marks it as received in its cache. Even if 10 neighbors broadcast the same alert, the phone only relays it once and ignores identical echoes.
3. **TTL Limiting**: Frames carry a strict Time-To-Live (`ttl=3`), capping maximum propagation depth to avoid infinite echo loops in enclosed rooms.
