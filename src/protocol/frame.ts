/**
 * AirGap.fm beacon frame: 14-Byte Binary Frame with 1-Byte Targeted Routing.
 * Meets Devin Hacks fast airtime requirement (<= 14 bytes, ~1.1 - 1.2s chirp duration).
 *
 * Header Byte [0]:
 *   bits 7..6: version (2 bits, FRAME_VERSION = 1)
 *   bits 5..4: frameType (2 bits: 0 = TEMPLATE_ALERT, 1 = CUSTOM_PAGER)
 *   bits 3..0: scriptId (4 bits: 0 = ASCII, 1 = MALAYALAM, 2 = HINDI)
 *
 * Byte [1]: targetNodeId (1 Byte)
 *   0x00: ROOM BROADCAST (all nodes display and relay)
 *   0xFF: PROJECTOR WALL (sink display node)
 *   0x01..0xFE: UNICAST (routed hop-by-hop toward specific device)
 *
 * Bytes [2..3]: alertId (uint16 BE)
 *
 * FrameType 0 (TEMPLATE_ALERT, 14 bytes):
 *   [0]      versionAndType (1B)
 *   [1]      targetNodeId (1B)
 *   [2..3]   alertId (2B uint16 BE)
 *   [4]      templateId (uint8)
 *   [5]      regionCode (uint8)
 *   [6..8]   params (3B: subjectId, actionId, locationId)
 *   [9]      hop(4 bits) | ttl(4 bits) — MUTABLE, excluded from MAC
 *   [10..13] MAC (truncated HMAC-SHA256, 4 bytes)
 *   Immutable bytes: [0..8] (9 bytes)
 *
 * FrameType 1 (CUSTOM_PAGER, 14 bytes):
 *   [0]      versionAndType (1B)
 *   [1]      targetNodeId (1B)
 *   [2..3]   alertId (2B uint16 BE)
 *   [4..8]   customPayload (5B compressed Indic / ASCII text)
 *   [9]      hop(4 bits) | ttl(4 bits) — MUTABLE, excluded from MAC
 *   [10..13] MAC (truncated HMAC-SHA256, 4 bytes)
 *   Immutable bytes: [0..8] (9 bytes)
 */

import { decodeIndicString, ScriptId } from './indicCodec';
import { NODE_ID_BROADCAST } from './nodeId';

export const FRAME_VERSION = 1;
export const FRAME_SIZE = 14;
export const TEMPLATE_FRAME_SIZE = 14;
export const CUSTOM_FRAME_SIZE = 14;
export const MAC_LENGTH = 4;

export const enum FrameType {
  TEMPLATE_ALERT = 0,
  CUSTOM_PAGER = 1,
  // Backward compatibility aliases
  BEACON = 0,
  HEARD = 2,
}

export interface BeaconFrame {
  version: number;
  type: FrameType;
  scriptId?: ScriptId;
  targetNodeId: number; // 0x00 = Broadcast, 0xFF = Wall, 0x01..0xFE = Unicast
  alertId: number;
  templateId?: number;
  regionCode?: number;
  params?: Uint8Array; // 3 bytes: [subjectId, actionId, locationId]
  customPayload?: Uint8Array; // up to 5 bytes
  customText?: string;
  originTimeBucket?: number;
  hop: number;
  ttl: number;
  mac: Uint8Array; // 4 bytes
}

/** Encode a BeaconFrame into a 14-byte Uint8Array */
export function encodeFrame(frame: BeaconFrame): Uint8Array {
  const isCustom = frame.type === FrameType.CUSTOM_PAGER;
  const payloadLen = isCustom && frame.customPayload && frame.customPayload.length > 5 ? 6 : 5;
  const size = isCustom && payloadLen === 6 ? 15 : 14;
  const buf = new Uint8Array(size);

  const scriptId = frame.scriptId ?? ScriptId.ASCII;
  const frameTypeBit = isCustom ? 1 : 0;
  const targetNodeId = frame.targetNodeId ?? NODE_ID_BROADCAST;

  // byte 0: version (2 bits) | frameType (2 bits) | scriptId (4 bits)
  buf[0] =
    ((frame.version & 0x03) << 6) |
    ((frameTypeBit & 0x03) << 4) |
    (scriptId & 0x0f);

  // byte 1: targetNodeId (1B)
  buf[1] = targetNodeId & 0xff;

  // bytes 2-3: alertId big-endian
  buf[2] = (frame.alertId >> 8) & 0xff;
  buf[3] = frame.alertId & 0xff;

  if (isCustom) {
    // bytes 4..4+payloadLen-1: customPayload
    const maxLen = payloadLen;
    if (frame.customPayload) {
      const len = Math.min(maxLen, frame.customPayload.length);
      for (let i = 0; i < len; i++) {
        buf[4 + i] = frame.customPayload[i];
      }
    }

    const hopIndex = 4 + maxLen;
    // hop (high nibble) | ttl (low nibble) — MUTABLE
    buf[hopIndex] = ((frame.hop & 0x0f) << 4) | (frame.ttl & 0x0f);

    // MAC (4 bytes)
    for (let i = 0; i < MAC_LENGTH; i++) {
      buf[hopIndex + 1 + i] = frame.mac ? (frame.mac[i] ?? 0) : 0;
    }
  } else {
    // byte 4: templateId
    buf[4] = frame.templateId ?? 1;

    // byte 5: regionCode
    buf[5] = frame.regionCode ?? 0;

    // bytes 6..8: 3-byte params (subjectId, actionId, locationId)
    const p = frame.params;
    buf[6] = p && p.length > 0 ? p[0] : 0;
    buf[7] = p && p.length > 1 ? p[1] : 0;
    buf[8] = p && p.length > 2 ? p[2] : 0;

    // byte 9: hop (high nibble) | ttl (low nibble) — MUTABLE
    buf[9] = ((frame.hop & 0x0f) << 4) | (frame.ttl & 0x0f);

    // bytes 10..13: MAC (4 bytes)
    for (let i = 0; i < MAC_LENGTH; i++) {
      buf[10 + i] = frame.mac ? (frame.mac[i] ?? 0) : 0;
    }
  }

  return buf;
}

/** Decode a 14-byte (or 15-byte) Uint8Array into a BeaconFrame */
export function decodeFrame(buf: Uint8Array): BeaconFrame | null {
  if (buf.length < 13) return null;

  const header = buf[0];
  const version = (header >> 6) & 0x03;
  const typeBit = (header >> 4) & 0x03;
  const scriptId = (header & 0x0f) as ScriptId;

  if (version !== FRAME_VERSION) return null;

  // Handle 14B or 15B modern frames with targetNodeId at [1]
  const targetNodeId = buf.length >= 14 ? buf[1] : NODE_ID_BROADCAST;
  const alertIdOffset = buf.length >= 14 ? 2 : 1;
  const alertId = (buf[alertIdOffset] << 8) | buf[alertIdOffset + 1];

  const hopIndex = buf.length - 5;
  const macIndex = buf.length - 4;

  const hopTtl = buf[hopIndex];
  const hop = (hopTtl >> 4) & 0x0f;
  const ttl = hopTtl & 0x0f;
  const mac = buf.slice(macIndex, macIndex + MAC_LENGTH);

  if (typeBit === 1) {
    // FrameType 1: CUSTOM_PAGER
    const payloadStart = buf.length >= 14 ? 4 : 3;
    const customPayload = buf.slice(payloadStart, hopIndex);
    const customText = decodeIndicString(customPayload, scriptId).trim();

    return {
      version,
      type: FrameType.CUSTOM_PAGER,
      scriptId,
      targetNodeId,
      alertId,
      customPayload,
      customText,
      hop,
      ttl,
      mac,
    };
  }

  // FrameType 0: TEMPLATE_ALERT
  const tplOffset = buf.length >= 14 ? 4 : 3;
  const templateId = buf[tplOffset];
  const regionCode = buf[tplOffset + 1];
  const params = buf.slice(tplOffset + 2, hopIndex);

  return {
    version,
    type: FrameType.TEMPLATE_ALERT,
    scriptId,
    targetNodeId,
    alertId,
    templateId,
    regionCode,
    params,
    hop,
    ttl,
    mac,
  };
}

/**
 * Extract the immutable portion of a frame buffer for MAC computation.
 * Covers all fields up to the mutable hop/ttl byte (buf.length - 5).
 */
export function getImmutableBytes(buf: Uint8Array): Uint8Array {
  const hopIndex = Math.max(0, buf.length - 5);
  return buf.slice(0, hopIndex);
}

/** Create a dedupe key from alertId + MAC bytes */
export function dedupeKey(frame: BeaconFrame): string {
  const macHex = Array.from(frame.mac)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${frame.alertId}-${macHex}`;
}

/** Compute the origin time bucket in minutes */
export function getTimeBucket(eventEpochMs: number, timestampMs: number): number {
  const diffMinutes = Math.floor((timestampMs - eventEpochMs) / 60000);
  return Math.max(0, Math.min(diffMinutes, 0xffff));
}

/** Check if a frame is expired */
export function isExpired(
  frame: BeaconFrame,
  eventEpochMs: number,
  nowMs: number,
  maxAgeMs: number = 10 * 60000
): boolean {
  if (frame.originTimeBucket === undefined) return false;
  const frameOriginMs = eventEpochMs + frame.originTimeBucket * 60000;
  return nowMs - frameOriginMs > maxAgeMs;
}
