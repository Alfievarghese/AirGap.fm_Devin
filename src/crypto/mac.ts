/**
 * Truncated HMAC-SHA256 using WebCrypto.
 * Demo key ships with the app — honest about this in README.
 */

// Demo key: 32 bytes, hardcoded. Production would use Ed25519 signatures.
const DEMO_KEY_HEX =
  'ec0e5e2a1b3c4d5e6f708192a3b4c5d6e7f80011223344556677889900aabbcc';

let _cryptoKey: CryptoKey | null = null;

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function getKey(): Promise<CryptoKey> {
  if (_cryptoKey) return _cryptoKey;

  const raw = hexToBytes(DEMO_KEY_HEX);
  _cryptoKey = await crypto.subtle.importKey(
    'raw',
    raw as unknown as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
  return _cryptoKey;
}

/** Compute truncated 4-byte (32-bit) HMAC-SHA256 over the given data */
export async function computeMAC(data: Uint8Array): Promise<Uint8Array> {
  const key = await getKey();
  const sig = await crypto.subtle.sign('HMAC', key, data as unknown as BufferSource);
  // Truncate to first 4 bytes (32-bit tag saves ~35% airtime while preventing forgery)
  return new Uint8Array(sig, 0, 4);
}

/** Verify a truncated 4-byte HMAC-SHA256 */
export async function verifyMAC(
  data: Uint8Array,
  mac: Uint8Array
): Promise<boolean> {
  const computed = await computeMAC(data);
  if (computed.length !== mac.length) return false;
  // Constant-time comparison
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed[i] ^ mac[i];
  }
  return diff === 0;
}
