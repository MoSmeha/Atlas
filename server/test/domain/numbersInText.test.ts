import { describe, expect, it } from 'vitest';
import { numbersInText } from '../../src/domain/numbersInText';

describe('numbersInText', () => {
  it('reads plain, decimal and grouped numbers', () => {
    expect(numbersInText('Qty 120 at 45.5 for SAR 12,500,000.00')).toEqual([120, 45.5, 12500000]);
  });

  it('gives percentages in both forms', () => {
    expect(numbersInText('VAT 15% and retention 10 %')).toEqual([15, 0.15, 10, 0.1]);
  });

  it('reads numbers inside JSON', () => {
    expect(numbersInText('{"rows":[["A1",48000000],["A2",250000.75]],"total":-3}')).toEqual([1, 48000000, 2, 250000.75, 3]);
  });

  it('does not join comma-separated lists into one number', () => {
    expect(numbersInText('items 1,2,3 and 12,5000')).toEqual([1, 2, 3, 12, 5000]);
  });

  it('reads Arabic-Indic digits and separators', () => {
    expect(numbersInText('١٢٬٥٠٠٫٢٥')).toEqual([12500.25]);
    expect(numbersInText('۴۵ ١٥٪')).toEqual([45, 15, 0.15]);
  });

  it('returns nothing for text without digits', () => {
    expect(numbersInText('no numbers here')).toEqual([]);
  });
});
