# AirGap.fm

A radio station made of phones. No internet needed.

One phone chirps, every phone in the room lights up and passes it on, with no internet, no Bluetooth and nothing to install.

![AirGap.fm Cover](cover.svg)

Live demo: https://airgap-fm.vercel.app

Demo video: [DEMO LINK]

QR code for phone demo: [QR CODE]

## Try it in 60 seconds

1. Open https://airgap-fm.vercel.app on Phone A and Phone B in any browser.
2. On Phone A, tap Start Acoustic Listener to turn on the microphone.
3. On Phone B, open Sender (TX).
4. On Phone B, tap Broadcast Emergency Beacon.
5. Phone B plays a short chirp. Phone A hears it, flashes bright green, and displays the message.

## Play modes

### The Wave
Implemented.
Phone screens light up in ripple sequence as the sound hops across the room.

### Telephone Game
Implemented.
Send custom text up to five characters long through the Custom Pager tab. The text hops from phone to phone.

### Hall FM
Implemented.
Room wide announcements for hackathon halls, order ready notices, or roll calls without cellular signal.

### Score Mode and Race Games
Planned.
Timed relay races across teams in large auditoriums.

## When it matters

When storms or floods knock out cellular towers and power grids, sound waves still travel through the air. AirGap.fm turns everyday mobile browsers into an emergency alert network that works when everything else fails.

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
- Shared key check: A 4 byte message authentication code stops ambient room noise from triggering alerts.

Full protocol details and byte diagrams live in [ARCHITECTURE.md](ARCHITECTURE.md).

## Measured results

Physical field test numbers: Not yet measured.

| Test Environment | Distance | Hop Count | Delivery Rate |
|---|---|---|---|
| [FIELD TEST NUMBERS] | | | |

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

Devin session link: [DEVIN SESSION LINK]

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
