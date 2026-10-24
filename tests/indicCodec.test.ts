import { describe, it, expect } from 'vitest';
import {
  encodeIndicString,
  decodeIndicString,
  detectScript,
  ScriptId,
  getScriptLabel,
} from '../src/protocol/indicCodec';
import {
  translateCustomText,
  transliterateISCII,
} from '../src/protocol/offlineTranslator';

describe('1-Byte Indic Unicode Offset Compressor', () => {
  it('detects scripts accurately', () => {
    expect(detectScript('HELP 101')).toBe(ScriptId.ASCII);
    expect(detectScript('സഹായം')).toBe(ScriptId.MALAYALAM);
    expect(detectScript('मदद चाहिए')).toBe(ScriptId.HINDI);
  });

  it('provides descriptive script labels', () => {
    expect(getScriptLabel(ScriptId.MALAYALAM)).toContain('Malayalam 1-Byte Compression Active');
    expect(getScriptLabel(ScriptId.HINDI)).toContain('Hindi 1-Byte Compression Active');
    expect(getScriptLabel(ScriptId.ASCII)).toContain('ASCII 1-Byte Mode Active');
  });

  it('encodes Malayalam "സഹായം" into 5 bytes (66% byte reduction vs 15 bytes in UTF-8)', () => {
    const text = 'സഹായം';
    const utf8Bytes = new TextEncoder().encode(text);
    expect(utf8Bytes.length).toBe(15); // 5 chars * 3 bytes in UTF-8

    const { scriptId, bytes } = encodeIndicString(text, 6);
    expect(scriptId).toBe(ScriptId.MALAYALAM);
    expect(bytes.length).toBe(5); // exactly 5 bytes (<= 6 bytes)

    const decoded = decodeIndicString(bytes, scriptId);
    expect(decoded).toBe(text);
  });

  it('encodes 6-character Malayalam word "വെള്ളം" into exactly 6 payload bytes', () => {
    const text = 'വെള്ളം';
    const utf8Bytes = new TextEncoder().encode(text);
    expect(utf8Bytes.length).toBe(18); // 6 chars * 3 bytes in UTF-8

    const { scriptId, bytes } = encodeIndicString(text, 6);
    expect(scriptId).toBe(ScriptId.MALAYALAM);
    expect(bytes.length).toBe(6);

    const decoded = decodeIndicString(bytes, scriptId);
    expect(decoded).toBe(text);
  });

  it('preserves Malayalam chillu letters without collision or corruption', () => {
    // ർ (CHILLU RR), ൽ (CHILLU L), ൻ (CHILLU N)
    const chilluWord = 'കാർ'; // car / karr
    const { scriptId, bytes } = encodeIndicString(chilluWord, 6);
    const decoded = decodeIndicString(bytes, scriptId);
    expect(decoded).toBe(chilluWord);
  });

  it('encodes and decodes Hindi "मदद" losslessly', () => {
    const text = 'मदद';
    const { scriptId, bytes } = encodeIndicString(text, 6);
    expect(scriptId).toBe(ScriptId.HINDI);
    expect(bytes.length).toBe(3);

    const decoded = decodeIndicString(bytes, scriptId);
    expect(decoded).toBe(text);
  });

  it('encodes and decodes ASCII strings losslessly', () => {
    const text = 'SOS 91';
    const { scriptId, bytes } = encodeIndicString(text, 6);
    expect(scriptId).toBe(ScriptId.ASCII);
    expect(bytes.length).toBe(6);

    const decoded = decodeIndicString(bytes, scriptId);
    expect(decoded).toBe(text);
  });

  it('handles spaces and digits in Indic strings', () => {
    const text = 'തീ 4';
    const { scriptId, bytes } = encodeIndicString(text, 6);
    const decoded = decodeIndicString(bytes, scriptId);
    expect(decoded).toBe(text);
  });
});

describe('Offline Trilingual Emergency Lexer & ISCII Transliteration', () => {
  it('translates emergency dictionary keywords offline', () => {
    // Malayalam -> English
    const res1 = translateCustomText('സഹായം', ScriptId.MALAYALAM, 'en');
    expect(res1.isDictionaryMatch).toBe(true);
    expect(res1.translatedText).toBe('help');

    // English -> Malayalam
    const res2 = translateCustomText('water', ScriptId.ASCII, 'ml');
    expect(res2.isDictionaryMatch).toBe(true);
    expect(res2.translatedText).toBe('വെള്ളം');

    // Malayalam -> Hindi
    const res3 = translateCustomText('വെള്ളം', ScriptId.MALAYALAM, 'hi');
    expect(res3.isDictionaryMatch).toBe(true);
    expect(res3.translatedText).toBe('पानी');

    // Hindi -> English
    const res4 = translateCustomText('मदद', ScriptId.HINDI, 'en');
    expect(res4.isDictionaryMatch).toBe(true);
    expect(res4.translatedText).toBe('help');
  });

  it('transliterates out-of-vocabulary words via ISCII relative offsets', () => {
    // Out-of-vocabulary name or location
    const out = transliterateISCII('അർജുൻ', ScriptId.MALAYALAM, 'hi');
    // Devanagari characters produced
    expect(out.charCodeAt(0)).toBeGreaterThanOrEqual(0x0900);
    expect(out.charCodeAt(0)).toBeLessThanOrEqual(0x097f);
  });
});
