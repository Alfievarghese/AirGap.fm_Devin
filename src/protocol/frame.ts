/**
 * EchoNet beacon frame: compact binary encoding.
 *
 * Layout (19 bytes):
 *   [0]     version(4 bits) | type(4 bits)
 *   [1..2]  alertId (uint16 BE)
 *   [3]     templateId (uint8)
 *   [4]     regionCode (uint8)
 *   [5..7]  params (3 bytes)
 *   [8..9]  originTime bucket (uint16 BE, minutes since event epoch)
 *   [10]    hop(4 bits) | ttl(4 bits) — MUTABLE
 *   [11..18] MAC (truncated HMAC-SHA256, 8 bytes)
 *
 * MAC covers bytes [0..9] only (immutable fields).
 * Hop and TTL at byte [10] are mutable and excluded from MAC.
 */

export const FRAME_VERSION = 1;
export const FRAME_SIZE = 19;
export const MAC_OFFSET = 11;
export const MAC_LENGTH = 8;
export const IMMUTABLE_END = 10; // bytes 0..9 are covered by MAC

export const enum FrameType {
  BEACON = 0x01,
  HEARD = 0x02,
}

export interface BeaconFrame {
  version: number;
  type: FrameType;
  alertId: number;
  templateId: number;
  regionCode: number;
  params: Uint8Array; // 3 bytes
  originTimeBucket: number;
  hop: number;
  ttl: number;
  mac: Uint8Array; // 8 bytes
}

/** Encode a BeaconFrame into a 19-byte Uint8Array */
export function encodeFrame(frame: BeaconFrame): Uint8Array {
  const buf = new Uint8Array(FRAME_SIZE);

  // byte 0: version (high nibble) | type (low nibble)
  buf[0] = ((frame.version & 0x0f) << 4) | (frame.type & 0x0f);

  // bytes 1-2: alertId big-endian
  buf[1] = (frame.alertId >> 8) & 0xff;
  buf[2] = frame.alertId & 0xff;

  // byte 3: templateId
  buf[3] = frame.templateId;

  // byte 4: regionCode
  buf[4] = frame.regionCode;

  // bytes 5-7: params
  buf[5] = frame.params[0] ?? 0;
  buf[6] = frame.params[1] ?? 0;
  buf[7] = frame.params[2] ?? 0;

  // bytes 8-9: originTimeBucket big-endian
  buf[8] = (frame.originTimeBucket >> 8) & 0xff;
  buf[9] = frame.originTimeBucket & 0xff;

  // byte 10: hop (high nibble) | ttl (low nibble) — MUTABLE
  buf[10] = ((frame.hop & 0x0f) << 4) | (frame.ttl & 0x0f);

  // bytes 11-18: MAC
  for (let i = 0; i < MAC_LENGTH; i++) {
    buf[MAC_OFFSET + i] = frame.mac[i] ?? 0;
  }

  return buf;
}

/** Decode a 19-byte Uint8Array into a BeaconFrame */
export function decodeFrame(buf: Uint8Array): BeaconFrame | null {
  if (buf.length < FRAME_SIZE) return null;

  const versionType = buf[0];
  const version = (versionType >> 4) & 0x0f;
  const type = (versionType & 0x0f) as FrameType;

  if (version !== FRAME_VERSION) return null;

  const alertId = (buf[1] << 8) | buf[2];
  const templateId = buf[3];
  const regionCode = buf[4];
  const params = new Uint8Array([buf[5], buf[6], buf[7]]);
  const originTimeBucket = (buf[8] << 8) | buf[9];
  const hopTtl = buf[10];
  const hop = (hopTtl >> 4) & 0x0f;
  const ttl = hopTtl & 0x0f;
  const mac = buf.slice(MAC_OFFSET, MAC_OFFSET + MAC_LENGTH);

  return {
    version,
    type,
    alertId,
    templateId,
    regionCode,
    params,
    originTimeBucket,
    hop,
    ttl,
    mac,
  };
}

/** Extract the immutable portion of a frame buffer (bytes 0..9) for MAC computation */
export function getImmutableBytes(buf: Uint8Array): Uint8Array {
  return buf.slice(0, IMMUTABLE_END);
}

/** Create a dedupe key from alertId + MAC bytes */
export function dedupeKey(frame: BeaconFrame): string {
  const macHex = Array.from(frame.mac)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${frame.alertId}:${macHex}`;
}

/** Get minutes since event epoch (midnight of event day) */
export function getTimeBucket(eventEpochMs: number, nowMs: number): number {
  const mins = Math.floor((nowMs - eventEpochMs) / 60000);
  return Math.max(0, Math.min(0xffff, mins));
}

/** Check if an alert is expired */
export function isExpired(
  frame: BeaconFrame,
  eventEpochMs: number,
  nowMs: number,
  expiryMs: number
): boolean {
  const frameTimeMs = eventEpochMs + frame.originTimeBucket * 60000;
  return nowMs - frameTimeMs > expiryMs;
}
