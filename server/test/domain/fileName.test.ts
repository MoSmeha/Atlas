import { describe, expect, it } from 'vitest';
import { fileSlug, fileTimestamp } from '../../src/domain/fileName';

describe('fileSlug', () => {
  it('turns a title into lower-case words joined by dashes', () => {
    expect(fileSlug('BOQ items above 1M (SAR)', 'result')).toBe('boq-items-above-1m-sar');
  });

  it('drops accents and characters that are unsafe in file names', () => {
    expect(fileSlug('Café ../ Résumé: "final"', 'result')).toBe('cafe-resume-final');
  });

  it('falls back when no ASCII letters or digits are left', () => {
    expect(fileSlug('جدول الكميات', 'result')).toBe('result');
    expect(fileSlug('   ', 'result')).toBe('result');
  });

  it('keeps the ASCII part of a mixed title', () => {
    expect(fileSlug('BOQ جدول 2026', 'result')).toBe('boq-2026');
  });

  it('shortens long titles at a word boundary', () => {
    const slug = fileSlug('concrete works '.repeat(10), 'result');
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug).toMatch(/^concrete-works-.*[a-z]$/);
  });
});

describe('fileTimestamp', () => {
  it('formats local date and time as yyyymmdd-hhmmss', () => {
    expect(fileTimestamp(new Date(2026, 9, 28, 14, 5, 9))).toBe('20261028-140509');
  });
});
