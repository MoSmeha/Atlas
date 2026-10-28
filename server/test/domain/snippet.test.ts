import { describe, expect, it } from 'vitest';
import { queryTerms, snippetAround } from '../../src/domain/snippet';

/** Distinct filler words that never match a query, e.g. "filler0 filler1 ...". */
function filler(count: number, from = 0): string {
  return Array.from({ length: count }, (_, i) => `filler${from + i}`).join(' ');
}

function words(text: string): string[] {
  return text.replace(/…/g, '').trim().split(' ');
}

describe('queryTerms', () => {
  it('keeps lower-case words of two characters or more, once each', () => {
    expect(queryTerms('Payment terms of Contract C-101, payment')).toEqual(['payment', 'terms', 'of', 'contract', '101']);
  });

  it('keeps Arabic words', () => {
    expect(queryTerms('شروط الدفع')).toEqual(['شروط', 'الدفع']);
  });
});

describe('snippetAround', () => {
  it('returns a short passage whole, with whitespace collapsed', () => {
    expect(snippetAround('  Payment\n\nterms:   30 days  ', 'payment')).toBe('Payment terms: 30 days');
  });

  it('cuts a long passage to about the given length around the match', () => {
    const text = `${filler(100)} the retention is ten percent ${filler(100, 100)}`;
    const snippet = snippetAround(text, 'retention', 200);
    expect(snippet).toContain('the retention is ten percent');
    expect(snippet.startsWith('…')).toBe(true);
    expect(snippet.endsWith('…')).toBe(true);
    expect(snippet.length).toBeLessThanOrEqual(202);
    expect(snippet.length).toBeGreaterThan(150);
  });

  it('cuts between words, never inside one', () => {
    const text = `${filler(100)} retention ${filler(100, 100)}`;
    const original = new Set(text.split(' '));
    for (const word of words(snippetAround(text, 'retention', 120))) expect(original.has(word)).toBe(true);
  });

  it('prefers the place where more query words appear together', () => {
    const text = `${filler(50)} retention ${filler(80, 50)} retention of money is ten percent ${filler(80, 130)}`;
    expect(snippetAround(text, 'retention money', 120)).toContain('retention of money is ten percent');
  });

  it('prefers the exact phrase over scattered words', () => {
    const text = `${filler(30)} payment ${filler(5, 30)} terms ${filler(80, 35)} payment terms are 30 days ${filler(80, 115)}`;
    expect(snippetAround(text, 'Payment Terms', 120)).toContain('payment terms are 30 days');
  });

  it('finds a word whose ending differs from the query', () => {
    const text = `${filler(100)} each payment is due monthly ${filler(100, 100)}`;
    expect(snippetAround(text, 'payments', 120)).toContain('each payment is due monthly');
  });

  it('shows the start of the passage when nothing matches', () => {
    const text = filler(200);
    const snippet = snippetAround(text, 'retention', 100);
    expect(snippet.startsWith('filler0 filler1')).toBe(true);
    expect(snippet.endsWith('…')).toBe(true);
  });

  it('shows the end of the passage without a trailing mark when the match is near the end', () => {
    const text = `${filler(200)} retention is released at handover`;
    const snippet = snippetAround(text, 'handover', 100);
    expect(snippet.endsWith('retention is released at handover')).toBe(true);
    expect(snippet.startsWith('…')).toBe(true);
  });

  it('finds Arabic words in a long passage', () => {
    const text = `${filler(100)} تكون شروط الدفع خلال ثلاثين يوما ${filler(100, 100)}`;
    expect(snippetAround(text, 'شروط الدفع', 120)).toContain('تكون شروط الدفع خلال ثلاثين يوما');
  });
});
