/**
 * Alert templates & 3-Dropdown Modular Sentence Builder.
 * Multilingual short messages broadcast meaning in 3-13 bytes instead of full text.
 */

export const enum RegionCode {
  GENERIC = 0,
  KERALA = 1,
  KARNATAKA = 2,
  TAMIL_NADU = 3,
}

export type Language = 'en' | 'ml' | 'hi';

export interface AlertTemplate {
  id: number;
  en: string;
  ml: string;
  hi: string;
  paramDesc?: string;
}

/** Pre-configured 1-tap template registry */
export const TEMPLATES: AlertTemplate[] = [
  {
    id: 0x01,
    en: 'DRILL: Flood alert. Move to higher ground.',
    ml: 'DRILL: വെള്ളപ്പൊക്ക മുന്നറിയിപ്പ്. ഉയർന്ന സ്ഥലത്തേക്ക് മാറുക.',
    hi: 'DRILL: बाढ़ चेतावनी। ऊँचे स्थान पर जाएँ।',
  },
  {
    id: 0x02,
    en: 'DRILL: Landslide warning. Evacuate immediately.',
    ml: 'DRILL: മണ്ണിടിച്ചിൽ മുന്നറിയിപ്പ്. ഉടൻ ഒഴിഞ്ഞു പോകുക.',
    hi: 'DRILL: भूस्खलन चेतावनी। तुरंत खाली करें।',
  },
  {
    id: 0x03,
    en: 'DRILL: Earthquake detected. Duck, cover, hold.',
    ml: 'DRILL: ഭൂകമ്പം. കുനിയുക, മറയ്ക്കുക, പിടിക്കുക.',
    hi: 'DRILL: भूकंप। झुकें, छिपें, पकड़ें।',
  },
  {
    id: 0x04,
    en: 'DRILL: All clear. Resume normal activity.',
    ml: 'DRILL: അപകടം ഒഴിഞ്ഞു. സാധാരണ പ്രവർത്തനങ്ങൾ തുടരുക.',
    hi: 'DRILL: खतरा टला। सामान्य गतिविधि फिर शुरू करें।',
  },
  {
    id: 0x05,
    en: 'DRILL: Shelter in place. Do not move.',
    ml: 'DRILL: സ്ഥലത്ത് തന്നെ നിൽക്കുക. മാറരുത്.',
    hi: 'DRILL: अपनी जगह पर रहें। हिलें नहीं।',
  },
  {
    id: 0x10,
    en: '🌊 The Wave! Ripple across the hall! Pass it on.',
    ml: '🌊 വേവ്! ഹാൾ മുഴുവൻ കൈമാറുക!',
    hi: '🌊 द वेव! पूरे हॉल में आगे बढ़ाएं!',
  },
  {
    id: 0x11,
    en: 'Hall FM: Order ready! Collect at counter.',
    ml: 'ഹാൾ എഫ്എം: ഓർഡർ റെഡി! കൗണ്ടറിൽ നിന്നും വാങ്ങുക.',
    hi: 'हॉल एफएम: आर्डर तैयार! काउंटर से प्राप्त करें।',
  },
  {
    id: 0x12,
    en: 'Hall FM: Hackathon roll call. Check in now.',
    ml: 'ഹാൾ എഫ്എം: ഹാക്കത്തോൺ ഹാജർ നില. ഇപ്പോൾ അറിയിക്കുക.',
    hi: 'हॉल एफएम: हैकाथॉन हाज़िरी। अभी दर्ज करें।',
  },
  {
    id: 0x13,
    en: 'Hall FM: Chai break! Hot tea served.',
    ml: 'ഹാൾ എഫ്എം: ചായ സമയം! ചൂടുള്ള ചായ റെഡി.',
    hi: 'हॉल एफएम: चाय का समय! गर्म चाय तैयार है।',
  },
  {
    id: 0x14,
    en: 'Match Alert: GOAL! Score update.',
    ml: 'മാച്ച് അപ്ഡേറ്റ്: ഗോൾ! സ്കോർ അപ്ഡേറ്റ്.',
    hi: 'मैच अपडेट: गोल! स्कोर अपडेट।',
  },
];

export interface ModularItem {
  id: number;
  en: string;
  ml: string;
  hi: string;
}

export const MODULAR_SUBJECTS: ModularItem[] = [
  { id: 0, en: 'Medical Team', ml: 'ഡോക്ടർമാർ', hi: 'चिकित्सा दल' },
  { id: 1, en: 'Rescue Boat', ml: 'രക്ഷാ ബോട്ട്', hi: 'बचाव नाव' },
  { id: 2, en: 'Drinking Water', ml: 'കുടിവെള്ളം', hi: 'पीने का पानी' },
  { id: 3, en: 'Food Packets', ml: 'ഭക്ഷണ പൊതികൾ', hi: 'भोजन पैकेट' },
  { id: 4, en: 'Elderly & Kids', ml: 'മുതിർന്നവരും കുട്ടികളും', hi: 'बुजुर्ग और बच्चे' },
  { id: 5, en: 'Emergency Shelter', ml: 'അഭയകേന്ദ്രം', hi: 'आपातकालीन आश्रय' },
  { id: 6, en: 'Fallen Power Line', ml: 'പൊട്ടിയ വൈദ്യുത ലൈൻ', hi: 'बिजली का तार गिरा' },
];

export const MODULAR_ACTIONS: ModularItem[] = [
  { id: 0, en: 'Required Urgently', ml: 'അടിയന്തിരമായി വേണം', hi: 'तुरंत आवश्यकता है' },
  { id: 1, en: 'Dispatched to Site', ml: 'പുറപ്പെട്ടു', hi: 'रवाना कर दिया गया' },
  { id: 2, en: 'Arrived at Location', ml: 'എത്തിച്ചേർന്നു', hi: 'पहुंच गए' },
  { id: 3, en: 'Evacuate Now', ml: 'ഉടൻ ഒഴിഞ്ഞുപോകുക', hi: 'तुरंत खाली करें' },
  { id: 4, en: 'Stand By in Place', ml: 'സ്ഥലത്ത് തുടരുക', hi: 'अपनी जगह पर रहें' },
  { id: 5, en: 'Route Blocked', ml: 'വഴി തടസ്സപ്പെട്ടു', hi: 'रास्ता बंद है' },
];

export const MODULAR_LOCATIONS: ModularItem[] = [
  { id: 0, en: 'Relief Camp Area', ml: 'ക്യാമ്പ് പ്രദേശം', hi: 'शिविर क्षेत्र' },
  { id: 1, en: 'River Bank', ml: 'പുഴയോരം', hi: 'नदी तट' },
  { id: 2, en: 'Sector 4 School', ml: 'സെക്ടർ 4 സ്കൂൾ', hi: 'सेक्टर 4 स्कूल' },
  { id: 3, en: 'Main Gate', ml: 'പ്രധാന ഗേറ്റ്', hi: 'मुख्य द्वार' },
  { id: 4, en: 'High Ground Hill', ml: 'ഉയർന്ന പ്രദേശം', hi: 'ऊँचा स्थान' },
  { id: 5, en: 'Bridge Junction', ml: 'പാലം ജംഗ്ഷൻ', hi: 'पुल जंक्शन' },
  { id: 6, en: 'Community Hall', ml: 'കമ്മ്യൂണിറ്റി ഹാൾ', hi: 'सामुदायिक भवन' },
];

/** Look up a template by ID */
export function getTemplate(templateId: number): AlertTemplate | undefined {
  return TEMPLATES.find((t) => t.id === templateId);
}

/** Render a modular 3-dropdown sentence */
export function renderModularAlert(
  subjectId: number,
  actionId: number,
  locationId: number,
  lang: Language
): string {
  const subj = MODULAR_SUBJECTS.find((s) => s.id === subjectId) ?? MODULAR_SUBJECTS[0];
  const act = MODULAR_ACTIONS.find((a) => a.id === actionId) ?? MODULAR_ACTIONS[0];
  const loc = MODULAR_LOCATIONS.find((l) => l.id === locationId) ?? MODULAR_LOCATIONS[0];

  return `${subj[lang]} • ${act[lang]} • ${loc[lang]}`;
}

/** Render a template in the requested language */
export function renderTemplate(
  templateId: number,
  lang: Language,
  params?: Uint8Array
): string {
  // If template is custom modular builder (id 0xFF or params provided)
  if (templateId === 0xff && params && params.length >= 3) {
    return renderModularAlert(params[0], params[1], params[2], lang);
  }

  const tpl = getTemplate(templateId);
  if (!tpl) {
    if (params && params.length >= 3) {
      return renderModularAlert(params[0], params[1], params[2], lang);
    }
    return `[Unknown template ${templateId}]`;
  }
  return tpl[lang];
}
