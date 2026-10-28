import { describe, expect, it } from 'vitest';
import { cutText, fitPages } from '../../src/domain/pageBudget';

function page(number: number, length: number) {
  return { number, text: 'x'.repeat(length) };
}

describe('fitPages', () => {
  it('takes every page when they fit together', () => {
    const pages = [page(1, 100), page(2, 200), page(3, 300)];
    expect(fitPages(pages, 600)).toEqual(pages.map((p) => ({ ...p, cut: false })));
  });

  it('stops before the page that would pass the budget', () => {
    const fitted = fitPages([page(4, 6000), page(5, 6000), page(6, 6000)], 15_000);
    expect(fitted.map((p) => p.number)).toEqual([4, 5]);
    expect(fitted.every((p) => !p.cut)).toBe(true);
  });

  it('stops before an oversized later page instead of cutting it', () => {
    expect(fitPages([page(1, 100), page(2, 20_000)], 15_000).map((p) => [p.number, p.cut])).toEqual([[1, false]]);
  });

  it('cuts an oversized first page and takes nothing after it', () => {
    const fitted = fitPages([page(7, 20_000), page(8, 10)], 15_000);
    expect(fitted).toHaveLength(1);
    expect(fitted[0]?.number).toBe(7);
    expect(fitted[0]?.cut).toBe(true);
    expect(fitted[0]?.text.length).toBe(15_000);
  });

  it('counts empty pages as no text', () => {
    expect(fitPages([page(1, 0), page(2, 10), page(3, 0)], 10).map((p) => p.number)).toEqual([1, 2, 3]);
  });

  it('returns nothing for no pages', () => {
    expect(fitPages([], 100)).toEqual([]);
  });
});

describe('cutText', () => {
  it('returns short text unchanged, whitespace included', () => {
    expect(cutText('  Clause 4.2\n\nRetention  ', 100)).toBe('  Clause 4.2\n\nRetention  ');
  });

  it('ends before the last line break within reach', () => {
    const text = `${'a'.repeat(900)}\n${'b'.repeat(50)} ${'c'.repeat(100)}`;
    expect(cutText(text, 1000)).toBe('a'.repeat(900));
  });

  it('ends before a space when no line break is near', () => {
    const text = `${'a'.repeat(950)} ${'b'.repeat(100)}`;
    expect(cutText(text, 1000)).toBe('a'.repeat(950));
  });

  it('cuts at the limit when no line break or space is near', () => {
    const text = `${'a'.repeat(500)} ${'b'.repeat(1000)}`;
    expect(cutText(text, 1000)).toBe(text.slice(0, 1000));
  });

  it('never leaves half of a character outside the basic plane', () => {
    const text = `${'a'.repeat(999)}${'\u{1F600}'.repeat(5)}`;
    const cut = cutText(text, 1000);
    expect(cut).toBe('a'.repeat(999));
    expect(cut.codePointAt(cut.length - 1)).toBe('a'.codePointAt(0));
  });
});
