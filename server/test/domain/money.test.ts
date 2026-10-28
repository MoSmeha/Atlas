import { describe, expect, it } from 'vitest';
import { normalizeDigits, parseMoney, parseNumber } from '../../src/domain/money';

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

describe('parseMoney', () => {
  it.each([
    ['SAR 1,250,000.00', 1_250_000, 'SAR'],
    ['1,250,000 SAR', 1_250_000, 'SAR'],
    ['SAR1,250', 1250, 'SAR'],
    ['1,250SAR', 1250, 'SAR'],
    ['sar 500', 500, 'SAR'],
    ['SR 1.2M', 1_200_000, 'SAR'],
    ['SR. 500', 500, 'SAR'],
    ['S.R. 750.25', 750.25, 'SAR'],
    ['SAR 1.2M', 1_200_000, 'SAR'],
    ['1.2M SAR', 1_200_000, 'SAR'],
    ['SAR 2.4 billion', 2_400_000_000, 'SAR'],
    ['Saudi Riyals 10,000', 10_000, 'SAR'],
    ['10,000 Saudi Riyals', 10_000, 'SAR'],
    ['SR 1,000/-', 1000, 'SAR'],
    ['1,000/- SAR', 1000, 'SAR'],
    ['$1,200', 1200, 'USD'],
    ['$ 1,200.50', 1200.5, 'USD'],
    ['US$ 5,000', 5000, 'USD'],
    ['USD 45,000', 45_000, 'USD'],
    ['45,000 USD', 45_000, 'USD'],
    ['$.50', 0.5, 'USD'],
    ['€ 3,400.50', 3400.5, 'EUR'],
    ['€3,400.50', 3400.5, 'EUR'],
    ['EUR 3.400,50', 3400.5, 'EUR'],
    ['3.400,50 EUR', 3400.5, 'EUR'],
    ['EUR 1.250.000', 1_250_000, 'EUR'],
    ['AED 500', 500, 'AED'],
    ['£ 99.99', 99.99, 'GBP'],
    ['GBP 1,000', 1000, 'GBP'],
  ])('reads %s', (text, amount, currency) => {
    expect(parseMoney(text)).toEqual({ amount, currency });
  });

  it.each([
    ['1.2 million', 1_200_000],
    ['1.2 Million', 1_200_000],
    ['1.2M', 1_200_000],
    ['3.5 mn', 3_500_000],
    ['3.5mn', 3_500_000],
    ['3.5 MN', 3_500_000],
    ['2 mln', 2_000_000],
    ['2.4bn', 2_400_000_000],
    ['2.4 BN', 2_400_000_000],
    ['2.4 billion', 2_400_000_000],
    ['750K', 750_000],
    ['750k', 750_000],
    ['12.5 thousand', 12_500],
    ['0.07M', 70_000],
    ['1,250,000', 1_250_000],
    ['42', 42],
  ])('reads %s with no currency', (text, amount) => {
    expect(parseMoney(text)).toEqual({ amount, currency: null });
  });

  it.each([
    ['(1,000)', -1000, null],
    ['-1,000', -1000, null],
    ['(SAR 1,000)', -1000, 'SAR'],
    ['SAR (1,000)', -1000, 'SAR'],
    ['SAR(1,000)', -1000, 'SAR'],
    ['(1,000) SAR', -1000, 'SAR'],
    ['-SAR 1,000', -1000, 'SAR'],
    ['SAR -1,000', -1000, 'SAR'],
    ['-$1,200', -1200, 'USD'],
    ['$-1,200', -1200, 'USD'],
    ['(1.2M)', -1_200_000, null],
    ['SAR (2.4 billion)', -2_400_000_000, 'SAR'],
  ])('reads the negative amount %s', (text, amount, currency) => {
    expect(parseMoney(text)).toEqual({ amount, currency });
  });

  it.each([
    ['١٬٢٥٠٬٠٠٠ ر.س', 1_250_000, 'SAR'],
    ['ر.س ١٬٢٥٠٬٠٠٠', 1_250_000, 'SAR'],
    ['١٬٢٥٠٬٠٠٠٫٥٠ ر.س.', 1_250_000.5, 'SAR'],
    ['1,000 ريال', 1000, 'SAR'],
    ['١٠٠٠ ريال سعودي', 1000, 'SAR'],
    ['٥٠٠ ريالاً', 500, 'SAR'],
    ['1.5 مليون ريال', 1_500_000, 'SAR'],
    ['١٫٥ مليون ريال سعودي', 1_500_000, 'SAR'],
    ['٥ ملايين ريال', 5_000_000, 'SAR'],
    ['٥٠٠ ألف ريال', 500_000, 'SAR'],
    ['500 الف ريال', 500_000, 'SAR'],
    ['٣ آلاف ريال', 3000, 'SAR'],
    ['2 مليار ريال', 2_000_000_000, 'SAR'],
    ['ألف ريال', 1000, 'SAR'],
    ['مليون ريال', 1_000_000, 'SAR'],
    ['٢٫٥ مليون', 2_500_000, null],
    ['٥٠٠ درهم', 500, 'AED'],
    ['د.إ ٥٠٠', 500, 'AED'],
    ['١٠٠ دولار أمريكي', 100, 'USD'],
    ['٣٠٠ يورو', 300, 'EUR'],
    ['۱۲۳۴ ریال', 1234, 'SAR'],
  ])('reads the Arabic amount %s', (text, amount, currency) => {
    expect(parseMoney(text)).toEqual({ amount, currency });
  });

  it('reads amounts wrapped in direction marks and odd spaces', () => {
    const rlm = String.fromCodePoint(0x200f);
    const nbsp = String.fromCodePoint(0xa0);
    expect(parseMoney(`${rlm}١٬٠٠٠${rlm} ر.س`)).toEqual({ amount: 1000, currency: 'SAR' });
    expect(parseMoney(`SAR${nbsp}1,250`)).toEqual({ amount: 1250, currency: 'SAR' });
    expect(parseMoney('  SAR   1,250  ')).toEqual({ amount: 1250, currency: 'SAR' });
  });

  it.each([
    '',
    '   ',
    'SAR',
    'ريال',
    'Total',
    'N/A',
    '-',
    'Lump sum',
    'Item 3B',
    '3B',
    '12 m',
    '1.2m',
    '12 mm',
    '1,000 kg',
    '12%',
    'SAR 12%',
    'Total SAR 1,000',
    'SAR 1,000 only',
    'SAR 1,000 USD',
    'USD SAR 1,000',
    'C$ 1,000',
    '1,000 SARL',
    'SAR 1,2345',
    '1,25,000',
    '((1,000))',
    '-(1,000)',
    '(SAR -1,000)',
    'SAR 1.2 M M',
    'million',
    'M',
    'ألف',
    'مليون',
    'بالريال',
    '1,000 بالريال',
    '5 دولار كندي',
  ])('is null for %s', (text) => {
    expect(parseMoney(text)).toBeNull();
  });

  it('never rounds and never leaves float noise', () => {
    expect(parseMoney('SAR 1,234,567.891')?.amount).toBe(1_234_567.891);
    expect(parseMoney('0.1M')?.amount).toBe(100_000);
    expect(parseMoney('1.23456789 bn')?.amount).toBe(1_234_567_890);
    expect(parseMoney('SAR 0.30')?.amount).toBe(0.3);
    expect(parseMoney('1.005 SAR')?.amount).toBe(1.005);
  });

  it('never returns negative zero', () => {
    expect(Object.is(parseMoney('(SAR 0.00)')?.amount, 0)).toBe(true);
  });

  it('accepts the same currency written on both sides', () => {
    expect(parseMoney('$1,000 USD')).toEqual({ amount: 1000, currency: 'USD' });
  });
});
