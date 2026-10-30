import { describe, expect, it } from 'vitest';
import { freeProvider, isFreeModel } from '../../src/features/topbar/freeTier';

describe('freeProvider', () => {
  it('names Gemini and Ollama as free, and nothing for OpenAI or no provider', () => {
    expect(freeProvider('gemini')).toBe('gemini');
    expect(freeProvider('ollama')).toBe('ollama');
    expect(freeProvider('openai')).toBeNull();
    expect(freeProvider(null)).toBeNull();
    expect(freeProvider(undefined)).toBeNull();
  });
});

describe('isFreeModel', () => {
  it('is true only when input and output both cost nothing', () => {
    expect(isFreeModel({ inputPrice: 0, outputPrice: 0 })).toBe(true);
    expect(isFreeModel({ inputPrice: 0.1, outputPrice: 0 })).toBe(false);
    expect(isFreeModel(undefined)).toBe(false);
  });
});
