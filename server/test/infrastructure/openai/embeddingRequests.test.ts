import { describe, expect, it } from 'vitest';
import {
  EMBEDDING_LIMITS,
  estimateTokens,
  planEmbeddingRequests,
  toEmbeddingInput,
} from '../../../src/infrastructure/openai/embeddingRequests';

const sizes = (requests: string[][]) => requests.map((request) => request.length);

describe('estimateTokens', () => {
  it('counts three English characters per token, rounding up', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abc')).toBe(1);
    expect(estimateTokens('Concrete C40')).toBe(4);
  });

  it('counts one token per Arabic character', () => {
    expect(estimateTokens('أعمال')).toBe(5);
    expect(estimateTokens('BOQ أعمال')).toBe(2 + 5);
  });
});

describe('toEmbeddingInput', () => {
  it('turns every kind of line break into one space', () => {
    expect(toEmbeddingInput('Scope\nof\r\nworks\rhere')).toBe('Scope of works here');
  });

  it('never returns an empty string', () => {
    expect(toEmbeddingInput('')).toBe(' ');
    expect(toEmbeddingInput('  ')).toBe('  ');
  });

  it('cuts long English text at about 24,000 characters', () => {
    expect(toEmbeddingInput('a'.repeat(30_000))).toHaveLength(24_000);
    expect(toEmbeddingInput('a'.repeat(24_000))).toHaveLength(24_000);
  });

  it('cuts Arabic text sooner, so it stays under the per-input token limit', () => {
    expect(toEmbeddingInput('ب'.repeat(20_000))).toHaveLength(EMBEDDING_LIMITS.maxInputTokens);
  });

  it('never cuts an emoji in half', () => {
    expect(toEmbeddingInput(`ab${'😀'.repeat(3)}`, 4)).toBe('ab😀');
    expect(toEmbeddingInput(`a${'😀'.repeat(3)}`, 4)).toBe('a😀');
  });
});

describe('planEmbeddingRequests', () => {
  it('returns no requests for no texts', () => {
    expect(planEmbeddingRequests([])).toEqual([]);
  });

  it('sends at most 512 texts per request', () => {
    const texts = Array.from({ length: 1100 }, (_, i) => `chunk ${i}`);
    expect(sizes(planEmbeddingRequests(texts))).toEqual([512, 512, 76]);
  });

  it('starts a new request before the estimated tokens pass 250,000', () => {
    const texts = Array.from({ length: 600 }, () => 'x'.repeat(3000));
    expect(sizes(planEmbeddingRequests(texts))).toEqual([250, 250, 100]);
  });

  it('keeps input order, with one cleaned input per text', () => {
    const texts = ['first\nline', '', 'third', 'fourth', 'fifth'];
    const requests = planEmbeddingRequests(texts, { maxInputs: 2, maxRequestTokens: 100, maxInputTokens: 100 });
    expect(requests).toEqual([['first line', ' '], ['third', 'fourth'], ['fifth']]);
  });

  it('gives an input larger than the request budget a request of its own', () => {
    const requests = planEmbeddingRequests(['tiny', 'y'.repeat(30), 'tiny'], {
      maxInputs: 10,
      maxRequestTokens: 5,
      maxInputTokens: 10,
    });
    expect(requests).toEqual([['tiny'], ['y'.repeat(30)], ['tiny']]);
  });
});
