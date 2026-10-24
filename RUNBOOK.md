# EchoNet Runbook & Live Demo Playbook

> Complete operational guide for presenting the EchoNet live acoustic mesh demonstration at Devin Hacks Kochi.

---

## 1. Pre-Demo Setup Checklist (15 Minutes Before Presentation)

- [ ] **Laptop (The Wall Display)**:
  - Connect laptop to projector / external monitor.
  - Open Chrome to the deployed EchoNet URL or local IP `http://localhost:5173`.
  - Navigate to **Wall** screen tab.
  - Click **"Projector Fullscreen"** for edge-to-edge cockpit view.
  - Click **"Arm Wall Listener"** — verify status badge turns green `LISTEN`.
  - Test laptop microphone input sensitivity in VU meter.

- [ ] **Authority Phone (Presenter Phone)**:
  - Open EchoNet link in native Chrome or Safari.
  - Navigate to **Authority** tab.
  - Tap **"Fill Demo 1234"** to verify authorization PIN.
  - Set speaker volume to **80% - 90%** (avoid 100% max volume if speaker causes distortion clipping).

- [ ] **Audience / Relay Phones (2 to 4 volunteer phones)**:
  - Have volunteers scan QR code / open link.
  - Navigate to **Listener** tab.
  - Click **"Start Acoustic Mesh"** (grants mic permission and acquires screen wake lock).
  - Verify status badge shows green `LISTEN`.
  - **CRITICAL DEMO STEP**: Ask volunteers to switch **Airplane Mode ON** and **turn Wi-Fi / Bluetooth OFF**.
  - Space phones roughly 2 to 3 meters apart spanning from the presenter to the projector laptop.

---

## 2. 60–90 Second Live Presentation Script Checklist

1. **The Hook (15s)**:
   - "Cell towers and fiber lines fail during floods and landslides. But what never fails? Sound."
   - "Everyone on stage has their phone in full Airplane Mode. No Wi-Fi, no Bluetooth, no cellular."

2. **The Broadcast (20s)**:
   - Presenter opens **Authority** on phone A.
   - Selects template: `DRILL: Flood alert. Move to higher ground.`
   - Presses **"Broadcast Emergency Beacon"**.
   - Audience hears the distinctive acoustic data chirp.

3. **The Multi-Hop Acoustic Ripple (25s)**:
   - Phone B (in middle of room) detects the chirp, displays the alert in Malayalam (`വെള്ളപ്പൊക്ക മുന്നറിയിപ്പ്`), and relays it with a random backoff chirp.
   - The Wall display on the projector captures Hop 2, clocks the race latency (e.g. `2.74s`), and triggers the emergency alert card!

4. **The Proof (15s)**:
   - Point to the Wall: "Notice the hop counter reached Hop 2. The origin time bucket matched. The 8-byte HMAC verified cryptographically."
   - "This is the telephone game that never loses the message."

---

## 3. Failure Playbook & Troubleshooting

### Scenario A: Volunteer phone blocks microphone permission
- **Symptom**: Red error message "Mic permission denied".
- **Immediate Fix**: Click URL padlock icon in Chrome / Safari address bar → Site Settings → Reset Microphone permission to "Allow". Reload page.
- **Root Cause**: Opening inside Instagram or WhatsApp webview blocks mic capture. Always open directly in Chrome/Safari.

### Scenario B: iOS Safari phone stays silent (no sound transmission)
- **Symptom**: Authority transmits but no sound plays from iPhone speaker.
- **Immediate Fix**: 
  1. Toggle hardware mute switch on side of iPhone off (unmute).
  2. Tap screen once before pressing broadcast (triggers audio gesture unlock).
  3. EchoNet's silent HTML5 audio loop will route WebAudio to the media channel.

### Scenario C: High venue background noise (crowd cheering / loud music)
- **Symptom**: Decoder doesn't register frame at 4-5 meters.
- **Immediate Fix**:
  1. Move relay phones 1 meter closer together (2m spacing).
  2. Switch protocol in Lab / Config from `AUDIBLE_FAST` to `AUDIBLE_NORMAL` (slower FSK modulation with higher SNR tolerance).

### Scenario D: Two phones relay simultaneously and collide
- **Symptom**: Second hop delayed by 1–2 seconds.
- **Behavior**: Normal CSMA/CA backoff behavior! Each node has a randomized 200–500ms backoff jitter. Authority automatically repeats transmission 3 times with spacing to ensure packet delivery.
