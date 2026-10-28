import { describe, expect, it } from 'vitest';
import { normalizeDigits, parseNumber } from '../../src/domain/money';

describe('normalizeDigits', () => {
  it('turns Arabic-Indic digits into ASCII', () => {
    expect(normalizeDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
  });

  it('turns Extended Arabic-Indic digits into ASCII', () => {
    expect(normalizeDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
  });

  it('turns the Arabic decimal and thousands separators into "." and ","', () => {
    expect(normalizeDigits('١٬٢٥٠٬٠٠٠٫٥٠')).toBe('1,250,000.50');
  });

  it('leaves other text alone', () => {
    expect(normalizeDigits('SAR 1,250 ريال')).toBe('SAR 1,250 ريال');
    expect(normalizeDigits('')).toBe('');
  });
});

describe('parseNumber', () => {
  it.each([
    ['0', 0],
    ['42', 42],
    ['1250000', 1_250_000],
    ['1,250,000.00', 1_250_000],
    ['1,250', 1250],
    ['1,250.75', 1250.75],
    ['-3.5', -3.5],
    ['+3.5', 3.5],
    ['(1,000)', -1000],
    ['( 1,000.50 )', -1000.5],
    ['- 1,000', -1000],
    ['\u22121,000', -1000],
    ['\u20131,000', -1000],
    ['.5', 0.5],
    ['0.07', 0.07],
    ['  1,250  ', 1250],
    ['1 250 000', 1_250_000],
    ['1\u00A0250\u00A0000,50', 1_250_000.5],
    ['1\u202F250', 1250],
    ["1'250'000.50", 1_250_000.5],
    ['3.400,50', 3400.5],
    ['1.250.000', 1_250_000],
    ['1.250.000,75', 1_250_000.75],
    ['3,5', 3.5],
    ['3400,50', 3400.5],
    ['1.250', 1.25],
    ['١٢٣', 123],
    ['١٬٢٥٠٬٠٠٠', 1_250_000],
    ['١٢٫٥', 12.5],
    ['۱۲۳۴', 1234],
    ['\u200F١٬٠٠٠\u200F', 1000],
    ['\u202A-250\u202C', -250],
  ])('reads %s as %s', (text, value) => {
    expect(parseNumber(text)).toBe(value);
  });

  it.each([
    '',
    '   ',
    '-',
    '\u2013',
    '.',
    '5.',
    'N/A',
    'abc',
    'Item 3',
    '1,2345',
    '12,34,567',
    '1,25,000',
    '1.250.00',
    '1,250.000,00',
    '1.2.3',
    '12 34',
    '1 ,250',
    '(-1,000)',
    '-(1,000)',
    '((1,000))',
    '(1,000',
    '1,000-',
    '1e6',
    '12%',
    '12 m',
    '1.2M',
    'SAR 100',
  ])('is null for %s', (text) => {
    expect(parseNumber(text)).toBeNull();
  });

  it('reads a percentage as a fraction only when asked', () => {
    expect(parseNumber('12%')).toBeNull();
    expect(parseNumber('12%', { percent: true })).toBe(0.12);
    expect(parseNumber('12.5 %', { percent: true })).toBe(0.125);
    expect(parseNumber('-5%', { percent: true })).toBe(-0.05);
    expect(parseNumber('١٥٪', { percent: true })).toBe(0.15);
    expect(parseNumber('15', { percent: true })).toBe(15);
    expect(parseNumber('%', { percent: true })).toBeNull();
  });

  it('never returns negative zero', () => {
    expect(Object.is(parseNumber('-0'), 0)).toBe(true);
    expect(Object.is(parseNumber('(0.00)'), 0)).toBe(true);
  });

  it('keeps every digit instead of rounding', () => {
    expect(parseNumber('1,234,567.891')).toBe(1_234_567.891);
    expect(parseNumber('0.30')).toBe(0.3);
    expect(parseNumber('1.005')).toBe(1.005);
  });
});
