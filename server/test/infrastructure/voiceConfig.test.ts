import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VoiceDialect } from '@atlas/shared';
import { describe, expect, it } from 'vitest';
import { loadVoiceConfig, voiceConfigPath } from '../../src/infrastructure/config/voiceConfig';

const ARABIC_LETTER = /\p{Script=Arabic}/u;

function writeConfig(change: (config: Record<string, unknown>) => void): string {
  const config = JSON.parse(readFileSync(voiceConfigPath, 'utf8')) as Record<string, unknown>;
  change(config);
  const path = join(mkdtempSync(join(tmpdir(), 'atlas-voices-')), 'voices.json');
  writeFileSync(path, JSON.stringify(config));
  return path;
}

describe('loadVoiceConfig', () => {
  const catalog = loadVoiceConfig();

  it('reads the voices the repository ships, with GPT-Live for calls and gpt-transcribe for dictation', () => {
    expect(catalog.call.model).toBe('gpt-live-1');
    expect(catalog.dictation.model).toBe('gpt-transcribe');
    expect(catalog.voices.some((voice) => voice.id === catalog.defaultVoice)).toBe(true);
  });

  it('offers a female and a male voice for English and each Arabic dialect', () => {
    for (const dialect of VoiceDialect.options) {
      const genders = catalog.voices.filter((voice) => voice.dialect === dialect).map((voice) => voice.gender).toSorted();
      expect(genders, dialect).toEqual(['female', 'male']);
    }
  });

  it('writes each Arabic dialect in Arabic and designs its voices from a sample script', () => {
    for (const dialect of VoiceDialect.options.filter((name) => name !== 'english')) {
      const style = catalog.dialects[dialect];
      expect(style.language, dialect).toBe('ar');
      expect(style.speaking, dialect).toMatch(ARABIC_LETTER);
      expect(style.hello, dialect).toMatch(ARABIC_LETTER);
      expect(style.designScript?.length ?? 0, dialect).toBeGreaterThanOrEqual(200);
      expect(style.designScript?.length ?? 0, dialect).toBeLessThanOrEqual(2000);
    }
    const designed = catalog.voices.filter((voice) => voice.sound.kind === 'designed');
    expect(designed.map((voice) => voice.dialect).every((dialect) => dialect !== 'english')).toBe(true);
    expect(catalog.voices.filter((voice) => voice.dialect === 'english').map((voice) => voice.sound)).toEqual([
      { kind: 'builtIn', name: 'marin' },
      { kind: 'builtIn', name: 'cedar' },
    ]);
  });

  it('refuses a voice id used twice', () => {
    const path = writeConfig((config) => {
      const voices = config.voices as unknown[];
      voices.push(voices[0]);
    });
    expect(() => loadVoiceConfig(path)).toThrow(/used twice/);
  });

  it('refuses a default voice that does not exist', () => {
    expect(() => loadVoiceConfig(writeConfig((config) => (config.defaultVoice = 'nobody')))).toThrow(/No voice has the id .*nobody/);
  });

  it('refuses a designed voice whose dialect has no sample script', () => {
    const path = writeConfig((config) => {
      const dialects = config.dialects as Record<string, Record<string, unknown>>;
      if (dialects.gulf) dialects.gulf.designScript = null;
    });
    expect(() => loadVoiceConfig(path)).toThrow(/needs a sample script/);
  });
});
