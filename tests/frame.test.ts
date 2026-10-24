/**
 * Tests for frame encode/decode, MAC, dual frame types, targeted routing, dedupe, expiry.
 */
import { describe, it, expect } from 'vitest';
import {
  encodeFrame,
  decodeFrame,
  dedupeKey,
  getTimeBucket,
  isExpired,
  getImmutableBytes,
  BeaconFrame,
  FrameType,
  FRAME_VERSION,
  FRAME_SIZE,
} from '../src/protocol/frame';
import { ScriptId } from '../src/protocol/indicCodec';
import { NODE_ID_BROADCAST, NODE_ID_WALL } from '../src/protocol/nodeId';

function makeTemplateFrame(overrides?: Partial<BeaconFrame>): BeaconFrame {
  return {
    version: FRAME_VERSION,
    type: FrameType.TEMPLATE_ALERT,
    scriptId: ScriptId.ASCII,
    targetNodeId: NODE_ID_BROADCAST,
    alertId: 0x1234,
    templateId: 0x01,
    regionCode: 0x00,
    params: new Uint8Array([0x01, 0x02, 0x03]),
    hop: 2,
    ttl: 6,
    mac: new Uint8Array([0x11, 0x22, 0x33, 0x44]),
    ...overrides,
  };
}

function makeCustomFrame(overrides?: Partial<BeaconFrame>): BeaconFrame {
  return {
    version: FRAME_VERSION,
    type: FrameType.CUSTOM_PAGER,
    scriptId: ScriptId.MALAYALAM,
    targetNodeId: 0xa4, // Unicast to node #A4
    alertId: 0x5678,
    customPayload: new Uint8Array([0x38, 0x39, 0x3e, 0x2f, 0x02]), // 5 bytes
    hop: 1,
    ttl: 5,
    mac: new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]),
    ...overrides,
  };
}

describe('Frame encode/decode: FrameType 0 (TEMPLATE_ALERT 14B)', () => {
  it('encodes to exactly 14 bytes', () => {
    const frame = makeTemplateFrame();
    const buf = encodeFrame(frame);
    expect(buf.length).toBe(FRAME_SIZE);
    expect(buf.length).toBe(14);
  });

  it('roundtrips template alert with targetNodeId correctly', () => {
    const frame = makeTemplateFrame({ targetNodeId: NODE_ID_WALL });
    const buf = encodeFrame(frame);
    const decoded = decodeFrame(buf);

    expect(decoded).not.toBeNull();
    expect(decoded!.version).toBe(frame.version);
    expect(decoded!.type).toBe(FrameType.TEMPLATE_ALERT);
    expect(decoded!.targetNodeId).toBe(NODE_ID_WALL);
    expect(decoded!.alertId).toBe(frame.alertId);
    expect(decoded!.templateId).toBe(frame.templateId);
    expect(decoded!.regionCode).toBe(frame.regionCode);
    expect(decoded!.params).toEqual(frame.params);
    expect(decoded!.hop).toBe(frame.hop);
    expect(decoded!.ttl).toBe(frame.ttl);
    expect(decoded!.mac).toEqual(frame.mac);
  });
});

describe('Frame encode/decode: FrameType 1 (CUSTOM_PAGER 14B Unicast)', () => {
  it('encodes to exactly 14 bytes', () => {
    const frame = makeCustomFrame();
    const buf = encodeFrame(frame);
    expect(buf.length).toBe(14);
  });

  it('roundtrips custom pager frame with unicast targetNodeId', () => {
    const frame = makeCustomFrame({ targetNodeId: 0xa4 });
    const buf = encodeFrame(frame);
    const decoded = decodeFrame(buf);

    expect(decoded).not.toBeNull();
    expect(decoded!.version).toBe(frame.version);
    expect(decoded!.type).toBe(FrameType.CUSTOM_PAGER);
    expect(decoded!.scriptId).toBe(ScriptId.MALAYALAM);
    expect(decoded!.targetNodeId).toBe(0xa4);
    expect(decoded!.alertId).toBe(frame.alertId);
    expect(decoded!.customPayload).toEqual(frame.customPayload);
    expect(decoded!.hop).toBe(frame.hop);
    expect(decoded!.ttl).toBe(frame.ttl);
    expect(decoded!.mac).toEqual(frame.mac);
  });

  it('preserves full 6-letter words without dropping ending letters (e.g. DOCTOR)', () => {
    // ASCII encoding for "DOCTOR" (charCode - 0x20):
    // 'D': 68 - 32 = 36
    // 'O': 79 - 32 = 47
    // 'C': 67 - 32 = 35
    // 'T': 84 - 32 = 52
    // 'O': 79 - 32 = 47
    // 'R': 82 - 32 = 50
    const doctorBytes = new Uint8Array([36, 47, 35, 52, 47, 50]);
    const frame = makeCustomFrame({
      scriptId: ScriptId.ASCII,
      customPayload: doctorBytes,
    });
    const buf = encodeFrame(frame);
    expect(buf.length).toBe(15);

    const decoded = decodeFrame(buf);
    expect(decoded).not.toBeNull();
    expect(decoded!.customPayload?.length).toBe(6);
    expect(decoded!.customText).toBe('DOCTOR');
  });

  it('preserves full 7-letter words without dropping ending letters (e.g. SHELTER)', () => {
    // "SHELTER" -> 7 bytes
    const shelterBytes = new Uint8Array([
      'S'.charCodeAt(0) - 32,
      'H'.charCodeAt(0) - 32,
      'E'.charCodeAt(0) - 32,
      'L'.charCodeAt(0) - 32,
      'T'.charCodeAt(0) - 32,
      'E'.charCodeAt(0) - 32,
      'R'.charCodeAt(0) - 32,
    ]);
    const frame = makeCustomFrame({
      scriptId: ScriptId.ASCII,
      customPayload: shelterBytes,
    });
    const buf = encodeFrame(frame);
    expect(buf.length).toBe(16);

    const decoded = decodeFrame(buf);
    expect(decoded).not.toBeNull();
    expect(decoded!.customPayload?.length).toBe(7);
    expect(decoded!.customText).toBe('SHELTER');
  });
});

describe('Immutable bytes & MAC protection', () => {
  it('returns exactly 9 bytes for both 14B frames', () => {
    const tFrame = makeTemplateFrame();
    const tBuf = encodeFrame(tFrame);
    const tImmutable = getImmutableBytes(tBuf);
    expect(tImmutable.length).toBe(9);

    const cFrame = makeCustomFrame();
    const cBuf = encodeFrame(cFrame);
    const cImmutable = getImmutableBytes(cBuf);
    expect(cImmutable.length).toBe(9);
  });

  it('hop mutations do not affect immutable bytes', () => {
    const f1 = makeTemplateFrame({ hop: 1 });
    const f2 = makeTemplateFrame({ hop: 5 });
    const b1 = encodeFrame(f1);
    const b2 = encodeFrame(f2);
    expect(getImmutableBytes(b1)).toEqual(getImmutableBytes(b2));
  });
});

describe('Dedupe key', () => {
  it('same alertId and MAC produces same key', () => {
    const f1 = makeTemplateFrame();
    const f2 = makeTemplateFrame();
    expect(dedupeKey(f1)).toBe(dedupeKey(f2));
  });

  it('different alertId produces different key', () => {
    const f1 = makeTemplateFrame({ alertId: 1 });
    const f2 = makeTemplateFrame({ alertId: 2 });
    expect(dedupeKey(f1)).not.toBe(dedupeKey(f2));
  });
});

describe('Time bucket & Expiry', () => {
  it('computes minutes since epoch', () => {
    const epoch = 1000000;
    const now = epoch + 5 * 60000;
    expect(getTimeBucket(epoch, now)).toBe(5);
  });

  it('expires properly', () => {
    const epoch = 0;
    const fresh = makeTemplateFrame({ originTimeBucket: 10 });
    const old = makeTemplateFrame({ originTimeBucket: 0 });
    const now = epoch + 15 * 60000;

    expect(isExpired(fresh, epoch, now, 10 * 60000)).toBe(false);
    expect(isExpired(old, epoch, now, 10 * 60000)).toBe(true);
  });
});
