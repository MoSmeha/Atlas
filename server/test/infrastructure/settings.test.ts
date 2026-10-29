import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadSettings, repoRoot } from '../../src/infrastructure/settings';

function envFile(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'atlas-settings-'));
  const file = join(dir, '.env');
  writeFileSync(file, content);
  return file;
}

describe('loadSettings', () => {
  it('uses defaults when nothing is set', () => {
    const settings = loadSettings({}, join(tmpdir(), 'no-such-file.env'));
    expect(settings.openAiApiKey).toBeNull();
    expect(settings.port).toBe(3001);
    expect(settings.dataDir).toBe(join(repoRoot, '.atlas'));
    expect(settings.maxRounds).toBe(12);
  });

  it('reads the .env file and lets real environment variables win', () => {
    const file = envFile('OPENAI_API_KEY=sk-file\nPORT=4000\nATLAS_FOLDER=samples/x\n');
    const settings = loadSettings({ PORT: '5000' }, file);
    expect(settings.openAiApiKey).toBe('sk-file');
    expect(settings.port).toBe(5000);
    expect(settings.startFolder).toBe(join(repoRoot, 'samples', 'x'));
  });

  it('treats an empty key as missing', () => {
    const settings = loadSettings({ OPENAI_API_KEY: '  ' }, envFile(''));
    expect(settings.openAiApiKey).toBeNull();
  });

  it('rejects a port that is not a number', () => {
    expect(() => loadSettings({ PORT: 'abc' }, envFile(''))).toThrow();
  });

  it('picks the provider automatically unless ATLAS_PROVIDER names one, and rejects an unknown one', () => {
    const none = join(tmpdir(), 'no-such-file.env');
    expect(loadSettings({}, none)).toMatchObject({ provider: 'auto', geminiApiKey: null, ollamaUrl: 'http://127.0.0.1:11434' });
    expect(loadSettings({ ATLAS_PROVIDER: ' Gemini ', GEMINI_API_KEY: 'gm-key' }, none)).toMatchObject({ provider: 'gemini', geminiApiKey: 'gm-key' });
    expect(() => loadSettings({ ATLAS_PROVIDER: 'claude' }, none)).toThrow();
  });

  it('reads OLLAMA_HOST the way Ollama does', () => {
    const url = (host: string) => loadSettings({ OLLAMA_HOST: host }, join(tmpdir(), 'no-such-file.env')).ollamaUrl;
    expect(url('0.0.0.0')).toBe('http://127.0.0.1:11434');
    expect(url('localhost:8080')).toBe('http://localhost:8080');
    expect(url('http://gpu-box')).toBe('http://gpu-box:11434');
    expect(url('https://ollama.example.com')).toBe('https://ollama.example.com');
  });
});
