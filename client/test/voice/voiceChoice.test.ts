import type { VoiceOption } from '@atlas/shared';
import { describe, expect, it } from 'vitest';
import { chooseVoice, voiceName } from '../../src/features/voice/voiceChoice';

const voices: VoiceOption[] = [
  { id: 'english-female', label: 'English', nativeLabel: null, language: 'en', dialect: 'english', gender: 'female', ready: true },
  { id: 'gulf-female', label: 'Gulf Arabic', nativeLabel: 'خليجي', language: 'ar', dialect: 'gulf', gender: 'female', ready: true },
  { id: 'levantine-male', label: 'Levantine Arabic', nativeLabel: 'شامي', language: 'ar', dialect: 'levantine', gender: 'male', ready: true },
];

describe('chooseVoice', () => {
  it('keeps the voice this person picked last while it exists', () => {
    expect(chooseVoice({ voices, serverDefault: 'english-female', remembered: 'levantine-male', languages: ['en-US'] })).toBe(
      'levantine-male',
    );
    expect(chooseVoice({ voices, serverDefault: 'english-female', remembered: 'gone', languages: ['en-US'] })).toBe('english-female');
  });

  it('starts a browser set to Arabic in Gulf Arabic, and any other in the default', () => {
    expect(chooseVoice({ voices, serverDefault: 'english-female', remembered: null, languages: ['ar-SA', 'en'] })).toBe('gulf-female');
    expect(chooseVoice({ voices, serverDefault: 'english-female', remembered: null, languages: ['fr-FR'] })).toBe('english-female');
    expect(chooseVoice({ voices: voices.slice(0, 1), serverDefault: 'english-female', remembered: null, languages: ['ar'] })).toBe(
      'english-female',
    );
  });
});

describe('voiceName', () => {
  it('names the dialect and the voice', () => {
    expect(voiceName(voices[1] as VoiceOption)).toBe('Gulf Arabic, female voice');
  });
});
