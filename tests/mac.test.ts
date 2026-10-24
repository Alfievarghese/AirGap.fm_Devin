/**
 * Tests for HMAC-SHA256 MAC module.
 */
import { describe, it, expect } from 'vitest';
import { computeMAC, verifyMAC } from '../src/crypto/mac';

describe('MAC', () => {
  it('produces 4 byte truncated HMAC', async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const mac = await computeMAC(data);
    expect(mac.length).toBe(4);
  });

  it('verifies correct MAC', async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const mac = await computeMAC(data);
    const valid = await verifyMAC(data, mac);
    expect(valid).toBe(true);
  });

  it('rejects wrong MAC', async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const mac = await computeMAC(data);
    // Flip a bit
    const bad = new Uint8Array(mac);
    bad[0] ^= 0xff;
    const valid = await verifyMAC(data, bad);
    expect(valid).toBe(false);
  });

  it('produces different MACs for different data', async () => {
    const d1 = new Uint8Array([1, 2, 3]);
    const d2 = new Uint8Array([4, 5, 6]);
    const m1 = await computeMAC(d1);
    const m2 = await computeMAC(d2);
    expect(m1).not.toEqual(m2);
  });

  it('produces same MAC for same data (deterministic)', async () => {
    const data = new Uint8Array([10, 20, 30, 40]);
    const m1 = await computeMAC(data);
    const m2 = await computeMAC(data);
    expect(m1).toEqual(m2);
  });
});
