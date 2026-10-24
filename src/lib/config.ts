/**
 * AirGap.fm relay configuration.
 * Every tunable parameter in one place for simulator and field test tuning.
 */
export interface RelayConfig {
  /** Suppress relay if this many duplicates heard (Trickle k) */
  k: number;
  /** Listen-only period before first relay: [min, max] in ms */
  listenWindow: [number, number];
  /** Trickle interval doubling: Imin in ms */
  iMin: number;
  /** Trickle interval doubling: Imax in ms */
  iMax: number;
  /** Maximum hops before discard */
  ttl: number;
  /** Max retransmissions per alert per node */
  maxRetransmit: number;
  /** Carrier sense: band energy threshold (0..1) */
  carrierSenseThreshold: number;
  /** Carrier sense: backoff range [min, max] in ms */
  carrierSenseBackoff: [number, number];
  /** Carrier sense: max retries before drop */
  carrierSenseMaxRetries: number;
  /** Cooldown after transmit in ms (half duplex) */
  txCooldownMs: number;
  /** Minimum gap between any two transmissions in ms (duty cycle cap) */
  dutyCycleMs: number;
  /** Authority origin beacon repeat count */
  authorityRepeatCount: number;
  /** Authority repeat spacing [min, max] in ms */
  authorityRepeatSpacing: [number, number];
  /** Alert expiry in ms (from origin time bucket) */
  alertExpiryMs: number;
  /** ggwave protocol id string */
  ggwaveProtocol: string;
  /** ggwave volume 1..100 */
  ggwaveVolume: number;
  /** Sample rate (48000 preferred, read from AudioContext) */
  sampleRate: number;
}

export const DEFAULT_CONFIG: RelayConfig = {
  k: 2,
  listenWindow: [500, 1500],
  iMin: 2000,
  iMax: 8000,
  ttl: 6,
  maxRetransmit: 3,
  carrierSenseThreshold: 0.15,
  carrierSenseBackoff: [300, 1200],
  carrierSenseMaxRetries: 5,
  txCooldownMs: 150,
  dutyCycleMs: 4000,
  authorityRepeatCount: 3,
  authorityRepeatSpacing: [3000, 5000],
  alertExpiryMs: 10 * 60 * 1000,
  ggwaveProtocol: 'GGWAVE_PROTOCOL_AUDIBLE_FAST',
  ggwaveVolume: 35,
  sampleRate: 48000,
};

/** Return random integer in [min, max] */
export function randRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Return random float in [min, max] */
export function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}
