/**
 * Relay engine: Trickle-style gossip suppression (RFC 6206).
 *
 * Pure logic — no audio, no DOM. Injected clock for testability.
 * Audio engine calls relay.onFrameReceived() and relay tells it when to transmit.
 */

import {
  BeaconFrame,
  decodeFrame,
  encodeFrame,
  dedupeKey,
  isExpired,
  getImmutableBytes,
  FRAME_VERSION,
  FrameType,
} from '../protocol/frame';
import { verifyMAC } from '../crypto/mac';
import { RelayConfig, DEFAULT_CONFIG, randFloat } from '../lib/config';

export type TransmitCallback = (frameBytes: Uint8Array) => void;

export interface RelayStats {
  received: number;
  relayed: number;
  suppressed: number;
  expired: number;
  invalidMac: number;
  dropped: number;
  duplicates: number;
}

interface AlertState {
  /** Number of times we heard this exact alert */
  heardCount: number;
  /** Number of times we retransmitted */
  txCount: number;
  /** Pending relay timer (null if none) */
  timer: ReturnType<typeof setTimeout> | null;
  /** Current Trickle interval in ms */
  currentInterval: number;
  /** First heard timestamp */
  firstHeardAt: number;
}

export class RelayEngine {
  private config: RelayConfig;
  private alertStates = new Map<string, AlertState>();
  private stats: RelayStats = {
    received: 0,
    relayed: 0,
    suppressed: 0,
    expired: 0,
    invalidMac: 0,
    dropped: 0,
    duplicates: 0,
  };
  private lastTxTime = 0;
  private onTransmit: TransmitCallback | null = null;
  private eventEpochMs: number;
  private now: () => number;
  private onAlert: ((frame: BeaconFrame) => void) | null = null;

  constructor(
    config: Partial<RelayConfig> = {},
    clock?: () => number,
    eventEpochMs?: number
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.now = clock ?? (() => Date.now());
    // Default event epoch: midnight today
    this.eventEpochMs =
      eventEpochMs ??
      new Date(new Date().toDateString()).getTime();
  }

  setTransmitCallback(cb: TransmitCallback): void {
    this.onTransmit = cb;
  }

  setAlertCallback(cb: (frame: BeaconFrame) => void): void {
    this.onAlert = cb;
  }

  getStats(): RelayStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      received: 0,
      relayed: 0,
      suppressed: 0,
      expired: 0,
      invalidMac: 0,
      dropped: 0,
      duplicates: 0,
    };
  }

  /**
   * Called by audio engine when a frame is decoded from mic input.
   * Returns the parsed frame if valid, null otherwise.
   */
  async onFrameReceived(frameBytes: Uint8Array): Promise<BeaconFrame | null> {
    this.stats.received++;

    // 1. Decode
    const frame = decodeFrame(frameBytes);
    if (!frame) {
      this.stats.dropped++;
      return null;
    }

    // 2. Version check
    if (frame.version !== FRAME_VERSION) {
      this.stats.dropped++;
      return null;
    }

    // 3. Verify MAC over immutable bytes
    const encoded = encodeFrame(frame);
    const immutable = getImmutableBytes(encoded);
    const macValid = await verifyMAC(immutable, frame.mac);
    if (!macValid) {
      this.stats.invalidMac++;
      return null;
    }

    // 4. Expiry check
    if (
      isExpired(
        frame,
        this.eventEpochMs,
        this.now(),
        this.config.alertExpiryMs
      )
    ) {
      this.stats.expired++;
      return null;
    }

    // 5. Dedupe
    const key = dedupeKey(frame);
    let state = this.alertStates.get(key);

    if (state) {
      // Already heard this alert
      state.heardCount++;
      this.stats.duplicates++;

      // Trickle: if heard k copies, suppress pending relay
      if (state.heardCount >= this.config.k && state.timer) {
        clearTimeout(state.timer);
        state.timer = null;
        this.stats.suppressed++;
      }
      return frame;
    }

    // 6. New alert — notify UI
    if (this.onAlert) {
      this.onAlert(frame);
    }

    // 7. Check TTL
    if (frame.hop >= frame.ttl) {
      this.stats.dropped++;
      // Still return frame for UI display
      return frame;
    }

    // 8. Schedule relay with Trickle timing
    state = {
      heardCount: 1,
      txCount: 0,
      timer: null,
      currentInterval: this.config.iMin,
      firstHeardAt: this.now(),
    };
    this.alertStates.set(key, state);

    this.scheduleRelay(frame, state, key);

    return frame;
  }

  private scheduleRelay(
    frame: BeaconFrame,
    state: AlertState,
    key: string
  ): void {
    if (state.txCount >= this.config.maxRetransmit) return;

    // Random listen-only delay before first relay
    const listenDelay =
      state.txCount === 0
        ? randFloat(this.config.listenWindow[0], this.config.listenWindow[1])
        : 0;

    // Trickle interval: random point in [I/2, I]
    const relayDelay = randFloat(
      state.currentInterval / 2,
      state.currentInterval
    );

    const totalDelay = listenDelay + relayDelay;

    state.timer = setTimeout(() => {
      this.executeRelay(frame, state, key);
    }, totalDelay);
  }

  private executeRelay(
    frame: BeaconFrame,
    state: AlertState,
    key: string
  ): void {
    // Re-check suppression
    if (state.heardCount >= this.config.k) {
      this.stats.suppressed++;
      state.timer = null;
      return;
    }

    // Duty cycle check
    const now = this.now();
    const timeSinceLastTx = now - this.lastTxTime;
    if (timeSinceLastTx < this.config.dutyCycleMs) {
      // Defer
      const defer = this.config.dutyCycleMs - timeSinceLastTx + 50;
      state.timer = setTimeout(() => {
        this.executeRelay(frame, state, key);
      }, defer);
      return;
    }

    // Increment hop, keep ttl
    const relayFrame: BeaconFrame = {
      ...frame,
      hop: frame.hop + 1,
    };

    const relayBytes = encodeFrame(relayFrame);

    if (this.onTransmit) {
      this.onTransmit(relayBytes);
    }

    state.txCount++;
    this.lastTxTime = this.now();
    this.stats.relayed++;

    // Double interval for next retransmit (Trickle)
    state.currentInterval = Math.min(
      state.currentInterval * 2,
      this.config.iMax
    );

    // Schedule next retransmit if allowed
    if (state.txCount < this.config.maxRetransmit) {
      this.scheduleRelay(relayFrame, state, key);
    } else {
      state.timer = null;
    }
  }

  /** Cleanup old alerts from dedupe cache */
  cleanup(): void {
    const now = this.now();
    for (const [key, state] of this.alertStates.entries()) {
      if (now - state.firstHeardAt > this.config.alertExpiryMs) {
        if (state.timer) clearTimeout(state.timer);
        this.alertStates.delete(key);
      }
    }
  }

  destroy(): void {
    for (const [, state] of this.alertStates.entries()) {
      if (state.timer) clearTimeout(state.timer);
    }
    this.alertStates.clear();
  }
}
