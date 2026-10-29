import type { VoiceDialect, VoiceOption } from '@atlas/shared';
import { errors } from '../errors';

/** How a call speaks one dialect. The speaking rules are written in the dialect itself, which the voice follows best. */
export interface DialectStyle {
  /** For example "Gulf Arabic". */
  label: string;
  /** For example "خليجي"; null for English. */
  nativeLabel: string | null;
  language: 'en' | 'ar';
  /** Speaking rules for the call, in the dialect. */
  speaking: string;
  /** An example of the first thing Atlas says, in the dialect. */
  hello: string;
  /** Sample speech that designed voices of this dialect are made from; null when only built-in voices speak it. */
  designScript: string | null;
}

export interface CatalogVoice {
  id: string;
  dialect: VoiceDialect;
  gender: 'female' | 'male';
  sound: { kind: 'builtIn'; name: string } | { kind: 'designed'; description: string };
}

/** The voices a call can use and what calls and dictation cost, from server/config/voices.json. */
export interface VoiceCatalog {
  call: {
    model: string;
    /** US dollars per minute, billed per second while a call is open. */
    pricePerMinute: number;
    idleSeconds: number;
    maxMinutes: number;
  };
  dictation: {
    model: string;
    pricePerMinute: number;
    maxSeconds: number;
  };
  defaultVoice: string;
  dialects: Record<VoiceDialect, DialectStyle>;
  voices: CatalogVoice[];
}

/** A catalog voice by id; throws invalid_request for any other. */
export function findVoice(catalog: VoiceCatalog, id: string): CatalogVoice {
  const voice = catalog.voices.find((candidate) => candidate.id === id);
  if (voice === undefined) throw errors.invalidRequest(`Atlas has no voice called "${id}".`);
  return voice;
}

/** The voices as the call picker lists them. */
export function voiceOptions(catalog: VoiceCatalog): VoiceOption[] {
  return catalog.voices.map((voice) => {
    const dialect = catalog.dialects[voice.dialect];
    return {
      id: voice.id,
      label: dialect.label,
      nativeLabel: dialect.nativeLabel,
      language: dialect.language,
      dialect: voice.dialect,
      gender: voice.gender,
    };
  });
}
