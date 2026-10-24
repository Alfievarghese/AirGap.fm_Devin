/**
 * Alert templates: multilingual short messages from a template ID.
 * Templates let us broadcast meaning in a few bytes instead of full text.
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
  /** Optional param description */
  paramDesc?: string;
}

/**
 * Template registry.
 * Params byte usage documented per template.
 */
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
    en: 'Relay Race: Message hop! Pass it on.',
    ml: 'റിലേ റേസ്: സന്ദേശം വന്നു! കൈമാറുക.',
    hi: 'रिले रेस: संदेश आया! आगे भेजें।',
  },
];

/** Look up a template by ID */
export function getTemplate(templateId: number): AlertTemplate | undefined {
  return TEMPLATES.find((t) => t.id === templateId);
}

/** Render a template in the requested language */
export function renderTemplate(
  templateId: number,
  lang: Language,
  _params?: Uint8Array
): string {
  const tpl = getTemplate(templateId);
  if (!tpl) return `[Unknown template ${templateId}]`;
  return tpl[lang];
}
