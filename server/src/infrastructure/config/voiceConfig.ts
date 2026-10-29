import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { VoiceDialect } from '@atlas/shared';
import type { CatalogVoice, VoiceCatalog } from '../../application/voice/VoiceCatalog';
import { repoRoot } from '../settings';

const Dialect = z.object({
  label: z.string().min(1),
  nativeLabel: z.string().min(1).nullable(),
  language: z.enum(['en', 'ar']),
  speaking: z.string().min(1),
  hello: z.string().min(1),
  // The voice service takes up to 2,000 characters of sample speech and rejects one that is too short.
  designScript: z.string().min(200).max(2000).nullable(),
});

const VoiceBase = { id: z.string().regex(/^[a-z0-9-]{1,60}$/), dialect: VoiceDialect, gender: z.enum(['female', 'male']) };

const Voice = z.union([
  z.object({ ...VoiceBase, builtIn: z.string().min(1) }),
  z.object({ ...VoiceBase, design: z.string().min(40) }),
]);

const VoiceConfigSchema = z
  .object({
    call: z.object({
      model: z.string().min(1),
      pricePerMinute: z.number().nonnegative(),
      idleSeconds: z.number().int().min(15),
      maxMinutes: z.number().int().min(1).max(120),
    }),
    dictation: z.object({
      model: z.string().min(1),
      pricePerMinute: z.number().nonnegative(),
      maxSeconds: z.number().int().min(5).max(600),
    }),
    defaultVoice: z.string().min(1),
    dialects: z.record(VoiceDialect, Dialect),
    voices: z.array(Voice).min(1),
  })
  .superRefine((config, context) => {
    const ids = config.voices.map((voice) => voice.id);
    for (const id of ids.filter((id, at) => ids.indexOf(id) !== at)) {
      context.addIssue({ code: 'custom', path: ['voices'], message: `The voice id "${id}" is used twice.` });
    }
    if (!ids.includes(config.defaultVoice)) {
      context.addIssue({ code: 'custom', path: ['defaultVoice'], message: `No voice has the id "${config.defaultVoice}".` });
    }
    for (const voice of config.voices) {
      if ('design' in voice && config.dialects[voice.dialect].designScript === null) {
        context.addIssue({
          code: 'custom',
          path: ['dialects', voice.dialect, 'designScript'],
          message: `The designed voice "${voice.id}" needs a sample script for its dialect.`,
        });
      }
    }
  });

export const voiceConfigPath = resolve(repoRoot, 'server', 'config', 'voices.json');

/** The voice catalog, checked: unique ids, a default that exists, and a sample script for every designed voice. */
export function loadVoiceConfig(path: string = voiceConfigPath): VoiceCatalog {
  const config = VoiceConfigSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
  return {
    call: config.call,
    dictation: config.dictation,
    defaultVoice: config.defaultVoice,
    dialects: config.dialects,
    voices: config.voices.map(
      (voice): CatalogVoice => ({
        id: voice.id,
        dialect: voice.dialect,
        gender: voice.gender,
        sound: 'builtIn' in voice ? { kind: 'builtIn', name: voice.builtIn } : { kind: 'designed', description: voice.design },
      }),
    ),
  };
}
