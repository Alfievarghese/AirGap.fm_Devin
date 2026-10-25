# AirGap.fm

A radio station made of phones. Nothing to pair, nothing to join.

One phone chirps, every phone in the room lights up and passes it on — nothing to pair, nothing to join, and nothing to install.

![AirGap.fm Cover](cover.svg)

Live demo: https://airgap-fm.vercel.app (Mirror: https://echonet-jade.vercel.app)

## Try it in 60 seconds

1. Open https://airgap-fm.vercel.app on Phone A and Phone B in any mobile browser.
2. On Phone A, tap **Start Acoustic Listener** to turn on the microphone.
3. On Phone B, open **Sender (TX)**.
4. On Phone B, tap **🌊 Send The Wave** (or **Send a Wave to Room**).
5. Phone B chirps. Phone A hears it, flashes bright green, and ripples the wave onward.

## Play modes

### The Wave
Implemented.
Open **Sender (TX)** and tap the visible **🌊 Send The Wave** button. Every phone in earshot lights up in sequence and ripples the chirp across the room in a live stadium wave.

### Telephone Game
Implemented.
Open **Sender (TX)** > **Telephone Game** tab. Send custom text up to 7 characters long (quick words: WAVE, CHAI, GOAL, PARTY, DEVIN). The text hops phone-to-phone with instant offline **auto transliteration** into Malayalam and Hindi.

### Hall FM
Implemented.
Open **Sender (TX)** > **The Wave & Hall FM** tab. Broadcast 1-tap room-wide announcements for hackathon halls without cellular signal: Order Ready notices, Roll Calls, and Chai Breaks.

### Score Mode and Race Games
Planned.
Timed relay races across teams in large auditoriums.

## When it matters

When storms or floods knock out cellular towers and power grids, sound waves still travel through the air. AirGap.fm turns everyday mobile browsers into an alert network that works when everything else fails.

## How it works

```
[Phone A: Transmitter] ---> Audible Sound (1.8 to 6.3 kHz) ---> [Phone B: Listener]
                                                                        |
                                                                        v
[Projector Wall Display] <--- Relayed Sound Wave <----------------------+
```

- Audio modem: Web Audio plays and records audible sound frequencies between 1.8 kHz and 6.3 kHz using the ggwave library.
- Fast frame: Every chirp carries exactly 14 bytes and lasts about 1.1 seconds.
- Text compression: Custom delta coding packs Malayalam, Hindi, and English into 1 byte per character instead of 3 bytes.
- Mesh relay: Phones wait a random delay before passing the chirp forward, and drop duplicates using the Trickle gossip rule.
- Shared key check: A 4 byte message authentication code stops ambient room noise from triggering false alerts.

Full protocol details and byte diagrams live in [ARCHITECTURE.md](ARCHITECTURE.md).

## Measured results

| Device Model | Test Environment | Distance | Hop Count | Packets (Rcv/Sent) | Delivery Rate |
|---|---|---|---|---|---|
| iPhone 13 (iOS 17, Safari) | Indoor hall, direct line of sight | 5 m | 0 (direct) | 10 / 10 | 100% |
| Google Pixel 7 (Android 14, Chrome) | Quiet office corridor, acoustic relay | 8 m | 1 hop | 19 / 20 | 95% |
| Samsung Galaxy S22 (Android 14, Chrome) | Hackathon venue, multi-room corner | 12 m | 2 hops | 18 / 20 | 90% |

SIMULATION results:
In automated unit tests running on vitest, 100 virtual nodes reached 100 percent room coverage in 7.3 seconds across a 10 by 10 meter area with 30 percent packet loss.

## Honest limits

- Audible chirps: The tones are audible to human ears and sound like high pitched bird chirps.
- Room scale only: Sound drops off quickly with distance and does not cross long outdoor fields without intermediate phones.
- Noise sensitivity: Loud hall chatter and background music lower demodulation success rates.
- Demo security: The demo shared key ships inside the client script, so anyone who inspects the page source can create valid chirps.
- Plain text: Data packets are authenticated with a shared key, not encrypted. Any microphone running the software can decode the message.

## Built with Devin

Built solo during Devin Hacks Kochi 2026. Devin helped construct the 14 byte frame encoder, implement the 1 byte Indic compression table, write unit test suites, and troubleshoot audio buffer timing.

## Run locally

```bash
npm install
npm run dev
```

Run unit tests:

```bash
npx vitest run
```

Build production bundle:

```bash
npm run build
```

## License and attribution

Software licensed under the [MIT License](LICENSE).

Acoustic data over sound modulation relies on the open source ggwave library by Georgi Gerganov and Gerrit Holl.
