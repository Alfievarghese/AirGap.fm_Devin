/**
 * Tests for frame encode/decode, MAC, templates, dedupe, expiry.
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
  MAC_LENGTH,
} from '../src/protocol/frame';

function makeTestFrame(overrides?: Partial<BeaconFrame>): BeaconFrame {
  return {
    version: FRAME_VERSION,
    type: FrameType.BEACON,
    alertId: 0x1234,
    templateId: 0x01,
    regionCode: 0x00,
    params: new Uint8Array([0x0a, 0x0b, 0x0c]),
    originTimeBucket: 100,
    hop: 2,
    ttl: 6,
    mac: new Uint8Array([0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88]),
    ...overrides,
  };
}

describe('Frame encode/decode', () => {
  it('encodes to exactly FRAME_SIZE bytes', () => {
    const frame = makeTestFrame();
    const buf = encodeFrame(frame);
    expect(buf.length).toBe(FRAME_SIZE);
  });

  it('roundtrips correctly', () => {
    const frame = makeTestFrame();
    const buf = encodeFrame(frame);
    const decoded = decodeFrame(buf);

    expect(decoded).not.toBeNull();
    expect(decoded!.version).toBe(frame.version);
    expect(decoded!.type).toBe(frame.type);
    expect(decoded!.alertId).toBe(frame.alertId);
    expect(decoded!.templateId).toBe(frame.templateId);
    expect(decoded!.regionCode).toBe(frame.regionCode);
    expect(decoded!.params).toEqual(frame.params);
    expect(decoded!.originTimeBucket).toBe(frame.originTimeBucket);
    expect(decoded!.hop).toBe(frame.hop);
    expect(decoded!.ttl).toBe(frame.ttl);
    expect(decoded!.mac).toEqual(frame.mac);
  });

  it('rejects short buffer', () => {
    const buf = new Uint8Array(5);
    expect(decodeFrame(buf)).toBeNull();
  });

  it('rejects wrong version', () => {
    const frame = makeTestFrame({ version: 0x0f });
    // Manually encode with wrong version
    const buf = encodeFrame(frame);
    // decodeFrame checks version === FRAME_VERSION
    expect(decodeFrame(buf)).toBeNull();
  });

  it('preserves hop and ttl nibbles', () => {
    const frame = makeTestFrame({ hop: 0x0f, ttl: 0x0f });
    const buf = encodeFrame(frame);
    const decoded = decodeFrame(buf);
    expect(decoded!.hop).toBe(15);
    expect(decoded!.ttl).toBe(15);
  });

  it('encodes alertId as big-endian uint16', () => {
    const frame = makeTestFrame({ alertId: 0xabcd });
    const buf = encodeFrame(frame);
    expect(buf[1]).toBe(0xab);
    expect(buf[2]).toBe(0xcd);
  });
});

describe('Immutable bytes', () => {
  it('returns bytes 0..9', () => {
    const frame = makeTestFrame();
    const buf = encodeFrame(frame);
    const immutable = getImmutableBytes(buf);
    expect(immutable.length).toBe(10);
    // Changing hop should not affect immutable
    const frame2 = makeTestFrame({ hop: 5 });
    const buf2 = encodeFrame(frame2);
    const immutable2 = getImmutableBytes(buf2);
    expect(immutable).toEqual(immutable2);
  });
});

describe('Dedupe key', () => {
  it('same frame produces same key', () => {
    const f1 = makeTestFrame();
    const f2 = makeTestFrame();
    expect(dedupeKey(f1)).toBe(dedupeKey(f2));
  });

  it('different alertId produces different key', () => {
    const f1 = makeTestFrame({ alertId: 1 });
    const f2 = makeTestFrame({ alertId: 2 });
    expect(dedupeKey(f1)).not.toBe(dedupeKey(f2));
  });

  it('different hop same alertId and mac produces same key', () => {
    const f1 = makeTestFrame({ hop: 0 });
    const f2 = makeTestFrame({ hop: 3 });
    expect(dedupeKey(f1)).toBe(dedupeKey(f2));
  });
});

describe('Time bucket', () => {
  it('computes minutes since epoch', () => {
    const epoch = 1000000;
    const now = epoch + 5 * 60000; // 5 minutes later
    expect(getTimeBucket(epoch, now)).toBe(5);
  });

  it('clamps to 0 for past times', () => {
    const epoch = 1000000;
    const now = epoch - 100;
    expect(getTimeBucket(epoch, now)).toBe(0);
  });
});

describe('Expiry', () => {
  it('returns false for fresh alert', () => {
    const epoch = 0;
    const frame = makeTestFrame({ originTimeBucket: 10 });
    const now = epoch + 10 * 60000 + 1000; // just after the bucket
    expect(isExpired(frame, epoch, now, 10 * 60000)).toBe(false);
  });

  it('returns true for old alert', () => {
    const epoch = 0;
    const frame = makeTestFrame({ originTimeBucket: 0 });
    const now = epoch + 15 * 60000; // 15 min later
    expect(isExpired(frame, epoch, now, 10 * 60000)).toBe(true);
  });
});
