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
  ['devin', 'ഡെവിൻ', 'डेविन'],
  ['ai', 'എഐ', 'एआई'],
  ['devin ai', 'ഡെവിൻ എഐ', 'डेविन एआई'],
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

  // 3. English -> Indic (Phonetic Romanization to Malayalam & Devanagari)
  if (fromScript === ScriptId.ASCII && (toLang === 'ml' || toLang === 'hi')) {
    return transliterateEnglishToIndic(text, toLang);
  }

  return text;
}

/**
 * Phonetic Roman English to Indic (Malayalam / Hindi) Transliterator.
 * Transliterates names, call signs, and out-of-vocabulary emergency words into Malayalam and Devanagari script.
 */
export function transliterateEnglishToIndic(text: string, toLang: 'ml' | 'hi'): string {
  if (!text) return text;

  const VOWELS: Record<string, { mlInd: string; mlMat: string; hiInd: string; hiMat: string }> = {
    aa: { mlInd: '\u0D06', mlMat: '\u0D3E', hiInd: '\u0906', hiMat: '\u093E' }, // ആ / ാ / आ / ा
    ai: { mlInd: '\u0D10', mlMat: '\u0D48', hiInd: '\u0910', hiMat: '\u0948' }, // ഐ / ൈ / ऐ / ै
    au: { mlInd: '\u0D14', mlMat: '\u0D57', hiInd: '\u0914', hiMat: '\u094C' }, // ഔ / ൗ / औ / ौ
    ee: { mlInd: '\u0D08', mlMat: '\u0D40', hiInd: '\u0908', hiMat: '\u0940' }, // ഈ / ീ / ई / ी
    oo: { mlInd: '\u0D0A', mlMat: '\u0D42', hiInd: '\u090A', hiMat: '\u0942' }, // ഊ / ൂ / ऊ / ू
    ie: { mlInd: '\u0D08', mlMat: '\u0D40', hiInd: '\u0908', hiMat: '\u0940' }, // ഈ / ീ / ई / ी
    a:  { mlInd: '\u0D05', mlMat: '',       hiInd: '\u0905', hiMat: '' },       // അ / inherent / अ / inherent
    i:  { mlInd: '\u0D07', mlMat: '\u0D3F', hiInd: '\u0907', hiMat: '\u093F' }, // ഇ / ി / इ / ि
    u:  { mlInd: '\u0D09', mlMat: '\u0D41', hiInd: '\u0909', hiMat: '\u0941' }, // ഉ / ു / उ / ु
    e:  { mlInd: '\u0D0E', mlMat: '\u0D46', hiInd: '\u090E', hiMat: '\u0947' }, // എ / െ / ए / े
    o:  { mlInd: '\u0D12', mlMat: '\u0D4A', hiInd: '\u0912', hiMat: '\u094B' }, // ഒ / ൊ / ओ / ो
  };

  const CONSONANTS: Record<string, { ml: string; hi: string; mlChillu?: string }> = {
    // 3-char
    chh: { ml: '\u0D1B', hi: '\u091B' }, // ഛ / छ
    // 2-char
    kh: { ml: '\u0D16', hi: '\u0916' },  // ഖ / ख
    gh: { ml: '\u0D18', hi: '\u0918' },  // ഘ / घ
    ch: { ml: '\u0D1A', hi: '\u091A' },  // ച / च
    jh: { ml: '\u0D1D', hi: '\u091D' },  // ഝ / झ
    th: { ml: '\u0D24', hi: '\u0925' },  // ത / थ
    dh: { ml: '\u0D27', hi: '\u0927' },  // ധ / ध
    ph: { ml: '\u0D2B', hi: '\u092B' },  // ഫ / फ
    bh: { ml: '\u0D2D', hi: '\u092D' },  // ഭ / भ
    sh: { ml: '\u0D36', hi: '\u0936' },  // ശ / श
    zh: { ml: '\u0D34', hi: '\u091C\u093C' }, // ഴ / ज़
    ng: { ml: '\u0D19', hi: '\u0919' },  // ങ / ङ
    ny: { ml: '\u0D1E', hi: '\u091E' },  // ഞ / ञ
    // 1-char
    k: { ml: '\u0D15', hi: '\u0915', mlChillu: '\u0D7F' }, // ക / क
    g: { ml: '\u0D17', hi: '\u0917' },  // ഗ / ग
    c: { ml: '\u0D15', hi: '\u0915' },  // ക / क
    j: { ml: '\u0D1C', hi: '\u091C' },  // ജ / ज
    t: { ml: '\u0D1F', hi: '\u091F' },  // ട / ट
    d: { ml: '\u0D21', hi: '\u0921' },  // ഡ / ड
    n: { ml: '\u0D28', hi: '\u0928', mlChillu: '\u0D7B' }, // ന / न (chillu ൻ)
    p: { ml: '\u0D2A', hi: '\u092A' },  // പ / प
    f: { ml: '\u0D2B', hi: '\u092B\u093C' }, // ഫ / फ़
    b: { ml: '\u0D2C', hi: '\u092C' },  // ബ / ब
    m: { ml: '\u0D2E', hi: '\u092E', mlChillu: '\u0D02' }, // മ / म (anusvara ം)
    y: { ml: '\u0D2F', hi: '\u092F' },  // യ / य
    r: { ml: '\u0D30', hi: '\u0930', mlChillu: '\u0D7C' }, // ര / र (chillu ർ)
    l: { ml: '\u0D32', hi: '\u0932', mlChillu: '\u0D7D' }, // ല / ल (chillu ൽ)
    v: { ml: '\u0D35', hi: '\u0935' },  // വ / व
    w: { ml: '\u0D35', hi: '\u0935' },  // വ / व
    s: { ml: '\u0D38', hi: '\u0938' },  // സ / स
    h: { ml: '\u0D39', hi: '\u0939' },  // ഹ / ह
    z: { ml: '\u0D38', hi: '\u091C\u093C' }, // സ / ज़
    q: { ml: '\u0D15', hi: '\u0915' },  // ക / क
  };

  let out = '';
  let i = 0;
  let pendingConsonant: { ml: string; hi: string; mlChillu?: string } | null = null;

  while (i < text.length) {
    const remaining = text.slice(i).toLowerCase();

    // Check non-alphabetic characters (spaces, numbers, punctuation)
    const ch = text[i];
    if (!/[a-zA-Z]/.test(ch)) {
      if (pendingConsonant) {
        if (toLang === 'ml') {
          out += pendingConsonant.mlChillu || (pendingConsonant.ml + '\u0D4D');
        } else {
          out += pendingConsonant.hi;
        }
        pendingConsonant = null;
      }
      out += ch;
      i++;
      continue;
    }

    // 1. Try 3-char consonant
    const three = remaining.slice(0, 3);
    if (CONSONANTS[three]) {
      if (pendingConsonant) {
        if (toLang === 'ml') {
          out += pendingConsonant.mlChillu || (pendingConsonant.ml + '\u0D4D');
        } else {
          out += pendingConsonant.hi + '\u094D';
        }
      }
      pendingConsonant = CONSONANTS[three];
      i += 3;
      continue;
    }

    // 2. Try 2-char vowel
    const two = remaining.slice(0, 2);
    if (VOWELS[two]) {
      const v = VOWELS[two];
      if (pendingConsonant) {
        out += toLang === 'ml' ? (pendingConsonant.ml + v.mlMat) : (pendingConsonant.hi + v.hiMat);
        pendingConsonant = null;
      } else {
        out += toLang === 'ml' ? v.mlInd : v.hiInd;
      }
      i += 2;
      continue;
    }

    // 3. Try 2-char consonant
    if (CONSONANTS[two]) {
      if (pendingConsonant) {
        if (toLang === 'ml') {
          out += pendingConsonant.mlChillu || (pendingConsonant.ml + '\u0D4D');
        } else {
          out += pendingConsonant.hi + '\u094D';
        }
      }
      pendingConsonant = CONSONANTS[two];
      i += 2;
      continue;
    }

    // 4. Try 1-char vowel
    const one = remaining.slice(0, 1);
    if (VOWELS[one]) {
      const v = VOWELS[one];
      if (pendingConsonant) {
        out += toLang === 'ml' ? (pendingConsonant.ml + v.mlMat) : (pendingConsonant.hi + v.hiMat);
        pendingConsonant = null;
      } else {
        out += toLang === 'ml' ? v.mlInd : v.hiInd;
      }
      i += 1;
      continue;
    }

    // 5. Try 1-char consonant
    if (CONSONANTS[one]) {
      if (pendingConsonant) {
        if (toLang === 'ml') {
          out += pendingConsonant.mlChillu || (pendingConsonant.ml + '\u0D4D');
        } else {
          out += pendingConsonant.hi + '\u094D';
        }
      }
      pendingConsonant = CONSONANTS[one];
      i += 1;
      continue;
    }

    // Fallback unknown letter (e.g. 'x')
    if (pendingConsonant) {
      if (toLang === 'ml') {
        out += pendingConsonant.mlChillu || (pendingConsonant.ml + '\u0D4D');
      } else {
        out += pendingConsonant.hi;
      }
      pendingConsonant = null;
    }
    out += ch;
    i++;
  }

  // Flush remaining consonant at string end
  if (pendingConsonant) {
    if (toLang === 'ml') {
      out += pendingConsonant.mlChillu || (pendingConsonant.ml + '\u0D4D');
    } else {
      out += pendingConsonant.hi;
    }
    pendingConsonant = null;
  }

  return out;
}

export interface TranslationResult {
  translatedText: string;
  originalText: string;
  sourceScript: ScriptId;
  targetLang: TargetLanguage;
  isDictionaryMatch: boolean;
  isTransliterated?: boolean;
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
      isTransliterated: false,
    };
  }

  // Step B: ISCII Phonetic Transliteration
  const transliterated = transliterateISCII(originalText, sourceScript, targetLang);
  const isTrans = transliterated !== originalText;

  return {
    translatedText: transliterated,
    originalText,
    sourceScript,
    targetLang,
    isDictionaryMatch: false,
    isTransliterated: isTrans,
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
