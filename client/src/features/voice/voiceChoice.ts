import type { VoiceOption } from '@atlas/shared';
import type { Language } from '../../i18n/language';
import { callCopy } from './callCopy';

const STORAGE_KEY = 'atlas.voice';
/** The voice a browser set to Arabic starts with. */
const ARABIC_DEFAULT = 'gulf-female';

/**
 * The voice a call uses: the one this person picked last when it still exists, else Gulf Arabic for a browser set to
 * Arabic, else the server's default.
 */
export function chooseVoice(options: {
  voices: readonly VoiceOption[];
  serverDefault: string;
  remembered: string | null;
  languages: readonly string[];
}): string {
  const exists = (id: string | null): id is string => id !== null && options.voices.some((voice) => voice.id === id);
  if (exists(options.remembered)) return options.remembered;
  const arabic = options.languages.some((language) => language.toLowerCase().startsWith('ar'));
  if (arabic && exists(ARABIC_DEFAULT)) return ARABIC_DEFAULT;
  return options.serverDefault;
}

/** The voice this browser picked last. Storage can be off, as in a private window; then nothing is remembered. */
export function rememberedVoice(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function rememberVoice(id: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Not remembered; the picker still uses the choice for this page.
  }
}

/** "Gulf Arabic, female voice" for screen readers and the picker's tooltip, in the interface language. */
export function voiceName(voice: VoiceOption, language: Language = 'en'): string {
  return callCopy[language].picker.name(voice);
}
