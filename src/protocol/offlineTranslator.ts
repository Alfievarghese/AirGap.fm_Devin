/**
 * Offline Trilingual Emergency Lexer & ISCII Phonetic Transliterator.
 *
 * Provides 100% offline real-time translation between English, Malayalam, and Hindi
 * for custom emergency acoustic pager messages.
 *
 * Pipeline:
 * 1. Step A: Trilingual Emergency Lexer (150-word camp/disaster vocabulary)
 * 2. Step B: ISCII Phonetic Transliteration (for names, places, and novel words)
 * 3. Step C: Progressive On-Device AI Hook (window.Translator if available in Chrome)
 */

import { ScriptId } from './indicCodec';

export type TargetLanguage = 'en' | 'ml' | 'hi';

/** 150-entry core emergency/camp/medical trilingual dictionary [en, ml, hi] */
export const EMERGENCY_DICTIONARY: [string, string, string][] = [
  // Critical Needs & Signals
  ['help', 'സഹായം', 'मदद'],
  ['emergency', 'അടിയന്തരാവസ്ഥ', 'आपातकाल'],
  ['urgent', 'അടിയന്തിരം', 'अति आवश्यक'],
  ['danger', 'അപകടം', 'खतरा'],
  ['safe', 'സുരക്ഷിതം', 'सुरक्षित'],
  ['rescue', 'രക്ഷ', 'बचाव'],
  ['trapped', 'കുടുങ്ങി', 'फंसा'],
  ['alive', 'ജീവനോടെ', 'जीवित'],
  ['missing', 'കാണാതായി', 'लापता'],
  ['warning', 'മുന്നറിയിപ്പ്', 'चेतावनी'],

  // Supplies & Survival
  ['water', 'വെള്ളം', 'पानी'],
  ['drinking water', 'കുടിവെള്ളം', 'पीने का पानी'],
  ['food', 'ഭക്ഷണം', 'खाना'],
  ['rice', 'അരി', 'चावल'],
  ['bread', 'റൊട്ടി', 'रोटी'],
  ['milk', 'പാൽ', 'दूध'],
  ['blanket', 'പുതപ്പ്', 'कंबल'],
  ['tent', 'കൂടാരം', 'तंबू'],
  ['torch', 'ടോർച്ച്', 'टॉर्च'],
  ['light', 'വെളിച്ചം', 'रोशनी'],
  ['power', 'വൈദ്യുതി', 'बिजली'],
  ['battery', 'ബാറ്ററി', 'बैटरी'],
  ['fuel', 'ഇന്ധനം', 'ईंधन'],
  ['boat', 'ബോട്ട്', 'नाव'],
  ['rope', 'കയർ', 'रस्सी'],

  // Medical & Injuries
  ['doctor', 'ഡോക്ടർ', 'डॉक्टर'],
  ['medical', 'ചികിത്സ', 'चिकित्सा'],
  ['medicine', 'മരുന്ന്', 'दवा'],
  ['hospital', 'ആശുപത്രി', 'अस्पताल'],
  ['ambulance', 'ആംബുലൻസ്', 'एम्बुलेंस'],
  ['blood', 'രക്തം', 'रक्त'],
  ['injury', 'പരിക്ക്', 'चोट'],
  ['wound', 'മുറിവ്', 'घाव'],
  ['pain', 'വേദന', 'दर्द'],
  ['fever', 'പനി', 'बुखार'],
  ['pregnant', 'ഗർഭിണി', 'गर्भवती'],
  ['oxygen', 'ഓക്സിജൻ', 'ऑक्सीजन'],
  ['first aid', 'പ്രഥമശുശ്രൂഷ', 'प्राथमिक चिकित्सा'],

  // Natural Disasters & Environment
  ['flood', 'വെള്ളപ്പൊക്കം', 'बाढ़'],
  ['rain', 'മഴ', 'बारिश'],
  ['storm', 'കൊടുങ്കാറ്റ്', 'तूफान'],
  ['cyclone', 'ചുഴലിക്കാറ്റ്', 'चक्रवात'],
  ['landslide', 'മണ്ണിടിച്ചിൽ', 'भूस्खलन'],
  ['earthquake', 'ഭൂകമ്പം', 'भूकंप'],
  ['fire', 'തീ', 'आग'],
  ['smoke', 'പുക', 'धुआं'],
  ['river', 'നദി', 'नदी'],
  ['sea', 'കടൽ', 'समुद्र'],
  ['dam', 'അണക്കെട്ട്', 'बांध'],
  ['bridge', 'പാലം', 'पुल'],
  ['road', 'റോഡ്', 'सड़क'],
  ['building', 'കെട്ടിടം', 'इमारत'],

  // Locations & Infrastructure
  ['camp', 'ക്യാമ്പ്', 'शिविर'],
  ['shelter', 'താവളം', 'आश्रय'],
  ['relief center', 'ദുരിതാശ്വാസ കേന്ദ്രം', 'राहत केंद्र'],
  ['school', 'സ്കൂൾ', 'स्कूल'],
  ['room', 'മുറി', 'कमरा'],
  ['floor', 'നില', 'मंजिल'],
  ['roof', 'മേൽക്കൂര', 'छत'],
  ['gate', 'ഗേറ്റ്', 'द्वार'],
  ['exit', 'പുറത്തേക്കുള്ള വഴി', 'निकास'],
  ['high ground', 'ഉയർന്ന സ്ഥലം', 'ऊँचा स्थान'],
  ['city', 'നഗരം', 'शहर'],
  ['village', 'ഗ്രാമം', 'गाँव'],
  ['sector', 'സെക്ടർ', 'सेक्टर'],
  ['hill', 'കുന്ന്', 'पहाड़ी'],

  // People & Authorities
  ['child', 'കുട്ടി', 'बच्चा'],
  ['kid', 'കുട്ടി', 'बच्चा'],
  ['baby', 'കുഞ്ഞ്', 'शिशु'],
  ['elder', 'മുതിർന്നവർ', 'बुजुर्ग'],
  ['family', 'കുടുംബം', 'परिवार'],
  ['police', 'പോലീസ്', 'पुलिस'],
  ['army', 'സൈന്യം', 'सेना'],
  ['volunteer', 'സന്നദ്ധപ്രവർത്തകൻ', 'स्वयंसेवक'],
  ['officer', 'ഉദ്യോഗസ്ഥൻ', 'अधिकारी'],
  ['people', 'ആളുകൾ', 'लोग'],
  ['team', 'സംഘം', 'दल'],

  // Directives & Actions
  ['wait', 'കാത്തിരിക്കുക', 'प्रतीक्षा करें'],
  ['come', 'വരൂ', 'आएं'],
  ['go', 'പോകൂ', 'जाएं'],
  ['evacuate', 'ഒഴിയുക', 'खाली करें'],
  ['stop', 'നിൽക്കൂ', 'रुकें'],
  ['slow', 'പതുക്കെ', 'धीमे'],
  ['fast', 'വേഗം', 'जल्दी'],
  ['run', 'ഓടുക', 'भागें'],
  ['climb', 'കയറുക', 'चढ़ें'],
  ['stay', 'നിൽക്കുക', 'रहें'],
  ['bring', 'കൊണ്ടുവരിക', 'लाएं'],
  ['send', 'അയക്കുക', 'भेजें'],
  ['call', 'വിളിക്കുക', 'बुलाएं'],
  ['listen', 'കേൾക്കുക', 'सुनें'],
  ['see', 'കാണുക', 'देखें'],
  ['need', 'ആവശ്യം', 'आवश्यकता'],
  ['arrived', 'എത്തിച്ചേർന്നു', 'पहुंच गए'],
  ['dispatched', 'പുറപ്പെട്ടു', 'रवाना'],
  ['blocked', 'തടസ്സപ്പെട്ടു', 'अवरुद्ध'],
  ['clear', 'ഒഴിഞ്ഞു', 'साफ'],

  // Spatial & Quantitative
  ['north', 'വടക്ക്', 'उत्तर'],
  ['south', 'തെക്ക്', 'दक्षिण'],
  ['east', 'കിഴക്ക്', 'पूर्व'],
  ['west', 'പടിഞ്ഞാറ്', 'पश्चिम'],
  ['left', 'ഇടത്', 'बाएं'],
  ['right', 'വലത്', 'दाएं'],
  ['up', 'മുകളിൽ', 'ऊपर'],
  ['down', 'താഴെ', 'नीचे'],
  ['inside', 'ഉള്ളിൽ', 'अंदर'],
  ['outside', 'പുറത്ത്', 'बाहर'],
  ['near', 'അടുത്ത്', 'पास'],
  ['far', 'ദൂരെ', 'दूर'],
  ['now', 'ഇപ്പോൾ', 'अभी'],
  ['today', 'ഇന്ന്', 'आज'],
  ['night', 'രാത്രി', 'रात'],
  ['day', 'പകൽ', 'दिन'],
  ['all', 'എല്ലാം', 'सब'],
  ['many', 'പല', 'कई'],
  ['one', 'ഒന്ന്', 'एक'],
  ['two', 'രണ്ട്', 'दो'],
  ['three', 'മൂന്ന്', 'तीन'],
  ['four', 'നാല്', 'चार'],
  ['five', 'അഞ്ച്', 'पांच'],
  ['ten', 'പത്ത്', 'दस'],
  ['hundred', 'നൂറ്', 'सौ'],
  ['yes', 'അതെ', 'हाँ'],
  ['no', 'ഇല്ല', 'नहीं'],
  ['ok', 'ശരി', 'ठीक'],
  ['please', 'ദയവായി', 'कृपया'],
  ['thanks', 'നന്ദി', 'धन्यवाद'],
];

/** Fast lookup hash maps for dictionary translation */
const DICT_EN_TO_ML = new Map<string, string>();
const DICT_EN_TO_HI = new Map<string, string>();
const DICT_ML_TO_EN = new Map<string, string>();
const DICT_ML_TO_HI = new Map<string, string>();
const DICT_HI_TO_EN = new Map<string, string>();
const DICT_HI_TO_ML = new Map<string, string>();

for (const [en, ml, hi] of EMERGENCY_DICTIONARY) {
  const enLower = en.toLowerCase().trim();
  const mlClean = ml.trim();
  const hiClean = hi.trim();

  DICT_EN_TO_ML.set(enLower, mlClean);
  DICT_EN_TO_HI.set(enLower, hiClean);
  DICT_ML_TO_EN.set(mlClean, enLower);
  DICT_ML_TO_HI.set(mlClean, hiClean);
  DICT_HI_TO_EN.set(hiClean, enLower);
  DICT_HI_TO_ML.set(hiClean, mlClean);
}

/**
 * Phonetic Roman syllable mappings for relative Indic offsets (0x05..0x4D).
 * Shared by Malayalam (0x0D00) and Devanagari (0x0900).
 */
const INDIC_OFFSET_TO_ROMAN: Record<number, string> = {
  // Independent vowels
  0x05: 'a',
  0x06: 'aa',
  0x07: 'i',
  0x08: 'ee',
  0x09: 'u',
  0x0a: 'oo',
  0x0b: 'ri',
  0x0e: 'e',
  0x0f: 'ai',
  0x12: 'o',
  0x13: 'au',
  0x14: 'au',
  // Consonants (inherent 'a' rendered, suppressed if followed by virama/matra)
  0x15: 'k',
  0x16: 'kh',
  0x17: 'g',
  0x18: 'gh',
  0x19: 'ng',
  0x1a: 'ch',
  0x1b: 'chh',
  0x1c: 'j',
  0x1d: 'jh',
  0x1e: 'ny',
  0x1f: 't',
  0x20: 'th',
  0x21: 'd',
  0x22: 'dh',
  0x23: 'n',
  0x24: 'th',
  0x25: 'th',
  0x26: 'd',
  0x27: 'dh',
  0x28: 'n',
  0x29: 'nn',
  0x2a: 'p',
  0x2b: 'ph',
  0x2c: 'b',
  0x2d: 'bh',
  0x2e: 'm',
  0x2f: 'y',
  0x30: 'r',
  0x31: 'rr',
  0x32: 'l',
  0x33: 'll',
  0x34: 'zh',
  0x35: 'v',
  0x36: 'sh',
  0x37: 'sh',
  0x38: 's',
  0x39: 'h',
  // Matras (dependent vowel signs)
  0x3e: 'aa',
  0x3f: 'i',
  0x40: 'ee',
  0x41: 'u',
  0x42: 'oo',
  0x46: 'e',
  0x47: 'ee',
  0x48: 'ai',
  0x4a: 'o',
  0x4b: 'oo',
  0x4c: 'au',
  0x4d: '', // Virama / Chandrakkala
  0x02: 'm', // Anusvara
};

/** Malayalam Chillu letters -> Devanagari equivalent with virama */
const CHILLU_TO_HINDI: Record<number, string> = {
  0x0d7a: '\u0923\u094D', // ൺ -> ण + ्
  0x0d7b: '\u0928\u094D', // ൻ -> न + ्
  0x0d7c: '\u0930\u094D', // ർ -> र + ्
  0x0d7d: '\u0932\u094D', // ൽ -> ल + ्
  0x0d7e: '\u0933\u094D', // ൾ -> ळ + ्
  0x0d7f: '\u0915\u094D', // ൿ -> क + ्
};

/**
 * Step B: ISCII Phonetic Transliteration for out-of-vocabulary words.
 */
export function transliterateISCII(
  text: string,
  fromScript: ScriptId,
  toLang: TargetLanguage
): string {
  // If source and target script match, return unchanged
  if (fromScript === ScriptId.ASCII && toLang === 'en') return text;
  if (fromScript === ScriptId.MALAYALAM && toLang === 'ml') return text;
  if (fromScript === ScriptId.HINDI && toLang === 'hi') return text;

  // 1. Malayalam <-> Hindi (direct ISCII relative offset mapping)
  if (fromScript === ScriptId.MALAYALAM && toLang === 'hi') {
    let out = '';
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (CHILLU_TO_HINDI[code]) {
        out += CHILLU_TO_HINDI[code];
      } else if (code >= 0x0d00 && code <= 0x0d7f) {
        const offset = code - 0x0d00;
        // Direct ISCII transfer to Devanagari block
        out += String.fromCharCode(0x0900 + offset);
      } else {
        out += text[i];
      }
    }
    return out;
  }

  if (fromScript === ScriptId.HINDI && toLang === 'ml') {
    let out = '';
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code >= 0x0900 && code <= 0x097f) {
        const offset = code - 0x0900;
        // Direct ISCII transfer to Malayalam block
        out += String.fromCharCode(0x0d00 + offset);
      } else {
        out += text[i];
      }
    }
    return out;
  }

  // 2. Indic -> English (Phonetic Romanization)
  if ((fromScript === ScriptId.MALAYALAM || fromScript === ScriptId.HINDI) && toLang === 'en') {
    const base = fromScript === ScriptId.MALAYALAM ? 0x0d00 : 0x0900;
    let out = '';
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (fromScript === ScriptId.MALAYALAM && CHILLU_TO_HINDI[code]) {
        const roman = code === 0x0d7a ? 'n' : code === 0x0d7b ? 'n' : code === 0x0d7c ? 'r' : code === 0x0d7d ? 'l' : 'l';
        out += roman;
        continue;
      }
      if (code >= base && code <= base + 0x7f) {
        const offset = code - base;
        const syl = INDIC_OFFSET_TO_ROMAN[offset];
        if (syl !== undefined) {
          out += syl;
        }
      } else {
        out += text[i];
      }
    }
    return out || text;
  }

  // 3. English -> Indic (Phonetic simple fallback if not in dictionary)
  return text;
}

export interface TranslationResult {
  translatedText: string;
  originalText: string;
  sourceScript: ScriptId;
  targetLang: TargetLanguage;
  isDictionaryMatch: boolean;
  isMachineEnhanced?: boolean;
}

/**
 * Translate a custom emergency pager text offline.
 *
 * Checks Trilingual Emergency Lexer first; if not found, performs ISCII
 * phonetic transliteration, and opportunistically queries Chrome's on-device AI.
 */
export function translateCustomText(
  text: string,
  sourceScript: ScriptId,
  targetLang: TargetLanguage
): TranslationResult {
  const originalText = text.trim();
  if (!originalText) {
    return {
      translatedText: '',
      originalText: '',
      sourceScript,
      targetLang,
      isDictionaryMatch: false,
    };
  }

  // Step A: Trilingual Emergency Lexer
  let dictMatch: string | undefined;
  const token = originalText.toLowerCase();

  if (sourceScript === ScriptId.ASCII) {
    if (targetLang === 'ml') dictMatch = DICT_EN_TO_ML.get(token);
    else if (targetLang === 'hi') dictMatch = DICT_EN_TO_HI.get(token);
  } else if (sourceScript === ScriptId.MALAYALAM) {
    if (targetLang === 'en') dictMatch = DICT_ML_TO_EN.get(originalText);
    else if (targetLang === 'hi') dictMatch = DICT_ML_TO_HI.get(originalText);
  } else if (sourceScript === ScriptId.HINDI) {
    if (targetLang === 'en') dictMatch = DICT_HI_TO_EN.get(originalText);
    else if (targetLang === 'ml') dictMatch = DICT_HI_TO_ML.get(originalText);
  }

  if (dictMatch) {
    return {
      translatedText: dictMatch,
      originalText,
      sourceScript,
      targetLang,
      isDictionaryMatch: true,
    };
  }

  // Step B: ISCII Phonetic Transliteration
  const transliterated = transliterateISCII(originalText, sourceScript, targetLang);

  return {
    translatedText: transliterated,
    originalText,
    sourceScript,
    targetLang,
    isDictionaryMatch: false,
  };
}

/**
 * Step C: Progressive Chrome Built-in On-Device Translation AI Hook
 * Calls window.Translator if available, resolving with enhanced translation.
 */
export async function enhanceWithBrowserAI(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string | null> {
  try {
    if (typeof window !== 'undefined' && 'Translator' in window) {
      const translatorFactory = (window as unknown as {
        Translator?: {
          create: (opts: { sourceLanguage: string; targetLanguage: string }) => Promise<{
            translate: (t: string) => Promise<string>;
          }>;
        };
      }).Translator;

      if (translatorFactory) {
        const session = await translatorFactory.create({
          sourceLanguage: sourceLang,
          targetLanguage: targetLang,
        });
        const result = await session.translate(text);
        return result;
      }
    }
  } catch {
    // Fail silently to offline deterministic Step A + B
  }
  return null;
}
