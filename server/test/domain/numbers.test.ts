import { describe, expect, it } from 'vitest';
import { extractNumbers, numbersFromValue } from '../../src/domain/numbers';

const values = (text: string) => extractNumbers(text).map((mention) => mention.value);
const texts = (text: string) => extractNumbers(text).map((mention) => mention.text);

describe('extractNumbers', () => {
  it('reads plain, decimal and grouped numbers with their position', () => {
    expect(extractNumbers('Qty 120 at 45.50, total SAR 1,250,000.00.')).toEqual([
      { text: '120', index: 4, value: 120, decimals: 0, scale: 0, percent: false, grouped: false },
      { text: '45.50', index: 11, value: 45.5, decimals: 2, scale: 0, percent: false, grouped: false },
      { text: '1,250,000.00', index: 28, value: 1_250_000, decimals: 2, scale: 0, percent: false, grouped: true },
    ]);
  });

  it('scales suffixes and scale words exactly', () => {
    expect(values('SAR 1.25M, 1.2 million, 3bn, 5k, 2 mn and 4 thousand')).toEqual([
      1_250_000, 1_200_000, 3_000_000_000, 5000, 2_000_000, 4000,
    ]);
    expect(extractNumbers('1.25M')[0]).toMatchObject({ decimals: 2, scale: 6 });
  });

  it('reads Arabic scale words', () => {
    expect(values('١٫٥ مليون ريال و٥ آلاف و٢ مليار')).toEqual([1_500_000, 5000, 2_000_000_000]);
  });

  it('keeps lower-case m and other units as units, not scales', () => {
    expect(values('250mm slab, 12m long, a 30-day period')).toEqual([250, 12, 30]);
  });

  it('reads percentages', () => {
    const [vat, retention, words, arabic] = extractNumbers('VAT 15%, retention 10 %, 5 percent, ١٢٫٥٪');
    expect(vat).toMatchObject({ text: '15%', value: 15, percent: true });
    expect(retention).toMatchObject({ text: '10 %', value: 10, percent: true });
    expect(words).toMatchObject({ text: '5 percent', value: 5, percent: true });
    expect(arabic).toMatchObject({ text: '١٢٫٥٪', value: 12.5, percent: true, decimals: 1 });
  });

  it('reads Arabic-Indic digits and separators, keeping the text as written', () => {
    expect(extractNumbers('الإجمالي ١٬٢٥٠٬٠٠٠٫٥٠ ريال')).toEqual([
      { text: '١٬٢٥٠٬٠٠٠٫٥٠', index: 9, value: 1_250_000.5, decimals: 2, scale: 0, percent: false, grouped: true },
    ]);
    expect(values('۱۲۰ وحدة')).toEqual([120]);
  });

  it('reads a number with an Arabic proclitic glued to it', () => {
    expect(values('و١٥ يوما وب٢٠٠ ريال')).toEqual([15, 200]);
  });

  it('reads negatives written with a minus or in parentheses', () => {
    expect(extractNumbers('variance -3.5 and (1,000)')).toMatchObject([
      { text: '-3.5', value: -3.5 },
      { text: '(1,000)', value: -1000 },
    ]);
  });

  it('does not read a parenthesised percentage or a hyphen inside a word as negative', () => {
    expect(extractNumbers('retention (10%)')[0]).toMatchObject({ text: '10%', value: 10 });
    expect(values('pages 3-5')).toEqual([3, 5]);
  });

  it('reads a currency glued to the amount', () => {
    expect(texts('SAR1,000 and SR.500')).toEqual(['1,000', '500']);
  });

  it('reads European grouping and a single dot as a decimal point', () => {
    expect(values('1.250.000 and 3.400,50 and 1.250')).toEqual([1_250_000, 3400.5, 1.25]);
  });

  it('reads thin-space and no-break-space grouping', () => {
    expect(values('1 250 000 and 1 000')).toEqual([1_250_000, 1000]);
  });

  it('skips item codes, versions, clause numbers, file names, dates and times', () => {
    expect(values('A-12, Rev2, B2-005, 3.2.1, BOQ_Phase1_Rev2.xlsx, 12.pdf, 2026-10-28, 28/10/2026, 10:30, 1:100')).toEqual([]);
  });

  it('does not join a comma-separated list into one number', () => {
    expect(values('items 1, 2 and 3')).toEqual([1, 2, 3]);
    expect(values('items 1,2,3')).toEqual([]);
  });

  it('returns nothing for text without digits', () => {
    expect(extractNumbers('no numbers here')).toEqual([]);
    expect(extractNumbers('')).toEqual([]);
  });
});

describe('numbersFromValue', () => {
  it('collects number values and numeric strings from nested JSON', () => {
    const output = { columns: ['item_code', 'amount'], rows: [['C-01', 48_000_000], ['C-02', '250,000.75']], truncated: false };
    expect(numbersFromValue(output)).toEqual(expect.arrayContaining([48_000_000, 250_000.75]));
  });

  it('collects numbers inside text, codes and dates', () => {
    const found = numbersFromValue('Due 2027-03-15 for item B2-005, SAR 1.25M');
    expect(found).toEqual(expect.arrayContaining([2027, 3, 15, 2, 5, 1_250_000]));
  });

  it('gives a percentage as a fraction too', () => {
    expect(numbersFromValue('retention 10%')).toEqual(expect.arrayContaining([10, 0.1]));
  });

  it('reads Arabic-Indic digits in strings', () => {
    expect(numbersFromValue(['١٬٢٥٠٬٠٠٠'])).toEqual(expect.arrayContaining([1_250_000]));
  });

  it('keeps grouped numbers whole instead of splitting them at the commas', () => {
    expect(numbersFromValue('1,250,000')).not.toContain(250);
  });

  it('skips keys, nulls, booleans and non-finite numbers', () => {
    expect(numbersFromValue({ '2024': null, flag: true, ratio: Number.NaN, big: Number.POSITIVE_INFINITY })).toEqual([]);
  });
});
