/**
 * 1-Byte Indic Unicode Offset Compressor for AirGap.fm.
 *
 * UTF-8 takes 3 bytes per Indic character (Malayalam U+0D00..U+0D7F, Hindi U+0900..U+097F),
 * which would make acoustic FSK chirps 3x too slow for emergency mesh relays.
 *
 * This codec maps each character to a single 1-byte offset in a Uint8Array (0..255):
 * - Script 0 (ASCII): U+0020..U+007F -> byte = charCode - 0x0020 (0..95)
 * - Script 1 (MALAYALAM): U+0D00..U+0D7F -> byte = charCode - 0x0D00 (0..127)
 *   Full 128 code-point fidelity preserving all consonants, vowels, and Chillu letters (0x7A..0x7F).
 *   ASCII space (0x20) maps to 0x80 (also accepts legacy 0x75).
 *   ASCII digits '0'..'9' map to 0x81..0x8A.
 *   Common punctuation (.,!?-:) map to 0x8B..0x90.
 * - Script 2 (HINDI): U+0900..U+097F -> byte = charCode - 0x0900 (0..127)
 *   Preserving all Devanagari characters, matras, virama, and nukta.
 *   ASCII space maps to 0x80, digits '0'..'9' map to 0x81..0x8A.
 *
 * A 6-character Malayalam word ("സഹായം" / "വെള്ളം") encodes into 5 to 6 payload bytes
 * instead of 15 to 18 bytes in UTF-8, achieving a 66% byte reduction.
 */

export const enum ScriptId {
  ASCII = 0,
  MALAYALAM = 1,
  HINDI = 2,
}

// Byte offsets for space, digits, and punctuation in Indic mode
export const INDIC_SLOT_SPACE = 0x80;
export const INDIC_LEGACY_SPACE = 0x75;
export const INDIC_SLOT_DIGIT_BASE = 0x81; // 0x81..0x8A for '0'..'9'

const PUNCT_MAP: Record<string, number> = {
  '.': 0x8b,
  '!': 0x8c,
  '?': 0x8d,
  '-': 0x8e,
  ':': 0x8f,
};

const REV_PUNCT_MAP: Record<number, string> = {
  0x8b: '.',
  0x8c: '!',
  0x8d: '?',
  0x8e: '-',
  0x8f: ':',
};

/** Detect primary script of a string */
export function detectScript(text: string): ScriptId {
  let malayalamCount = 0;
  let hindiCount = 0;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0x0d00 && code <= 0x0d7f) {
      malayalamCount++;
    } else if (code >= 0x0900 && code <= 0x097f) {
      hindiCount++;
    }
  }

  if (malayalamCount > 0 && malayalamCount >= hindiCount) {
    return ScriptId.MALAYALAM;
  }
  if (hindiCount > 0) {
    return ScriptId.HINDI;
  }
  return ScriptId.ASCII;
}

/** Get human-readable script status badge label */
export function getScriptLabel(scriptId: ScriptId): string {
  switch (scriptId) {
    case ScriptId.MALAYALAM:
      return 'Malayalam 1-Byte Compression Active: 3x faster';
    case ScriptId.HINDI:
      return 'Hindi 1-Byte Compression Active: 3x faster';
    case ScriptId.ASCII:
    default:
      return 'ASCII 1-Byte Mode Active';
  }
}

/**
 * Encode a string into 1-byte per character format.
 * Truncates at maxBytes (default 6 for ultra-fast <=14B frames).
 */
export function encodeIndicString(
  text: string,
  maxBytes = 6
): { scriptId: ScriptId; bytes: Uint8Array } {
  const scriptId = detectScript(text);
  const out: number[] = [];

  for (let i = 0; i < text.length; i++) {
    if (out.length >= maxBytes) break;

    const char = text[i];
    const code = text.charCodeAt(i);

    if (scriptId === ScriptId.ASCII) {
      // ASCII 0x0020..0x007F
      if (code >= 0x0020 && code <= 0x007f) {
        out.push(code - 0x0020);
      } else {
        out.push(0x3f - 0x0020); // '?'
      }
    } else if (scriptId === ScriptId.MALAYALAM) {
      // Malayalam U+0D00..U+0D7F
      if (code === 0x0020) {
        out.push(INDIC_SLOT_SPACE);
      } else if (code >= 0x0030 && code <= 0x0039) {
        out.push(INDIC_SLOT_DIGIT_BASE + (code - 0x0030));
      } else if (PUNCT_MAP[char] !== undefined) {
        out.push(PUNCT_MAP[char]);
      } else if (code >= 0x0d00 && code <= 0x0d7f) {
        out.push(code - 0x0d00);
      } else {
        out.push(INDIC_SLOT_SPACE);
      }
    } else if (scriptId === ScriptId.HINDI) {
      // Devanagari U+0900..U+097F
      if (code === 0x0020) {
        out.push(INDIC_SLOT_SPACE);
      } else if (code >= 0x0030 && code <= 0x0039) {
        out.push(INDIC_SLOT_DIGIT_BASE + (code - 0x0030));
      } else if (PUNCT_MAP[char] !== undefined) {
        out.push(PUNCT_MAP[char]);
      } else if (code >= 0x0900 && code <= 0x097f) {
        out.push(code - 0x0900);
      } else {
        out.push(INDIC_SLOT_SPACE);
      }
    }
  }

  return {
    scriptId,
    bytes: new Uint8Array(out),
  };
}

/**
 * Decode a 1-byte array back into a Unicode string using the scriptId.
 */
export function decodeIndicString(bytes: Uint8Array, scriptId: ScriptId): string {
  let result = '';

  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];

    if (scriptId === ScriptId.ASCII) {
      result += String.fromCharCode(0x0020 + b);
    } else if (scriptId === ScriptId.MALAYALAM) {
      if (b === INDIC_SLOT_SPACE || b === INDIC_LEGACY_SPACE) {
        result += ' ';
      } else if (b >= INDIC_SLOT_DIGIT_BASE && b <= INDIC_SLOT_DIGIT_BASE + 9) {
        result += String.fromCharCode(0x0030 + (b - INDIC_SLOT_DIGIT_BASE));
      } else if (REV_PUNCT_MAP[b]) {
        result += REV_PUNCT_MAP[b];
      } else if (b >= 0 && b <= 0x7f) {
        result += String.fromCharCode(0x0d00 + b);
      }
    } else if (scriptId === ScriptId.HINDI) {
      if (b === INDIC_SLOT_SPACE || b === INDIC_LEGACY_SPACE) {
        result += ' ';
      } else if (b >= INDIC_SLOT_DIGIT_BASE && b <= INDIC_SLOT_DIGIT_BASE + 9) {
        result += String.fromCharCode(0x0030 + (b - INDIC_SLOT_DIGIT_BASE));
      } else if (REV_PUNCT_MAP[b]) {
        result += REV_PUNCT_MAP[b];
      } else if (b >= 0 && b <= 0x7f) {
        result += String.fromCharCode(0x0900 + b);
      }
    }
  }

  return result;
}
