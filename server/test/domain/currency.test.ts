import { describe, expect, it } from 'vitest';
import {
  CURRENCY_CODES,
  currencyCode,
  currencyKey,
  detectCurrencies,
  detectCurrency,
  formatMoney,
  isCurrencyCode,
  sumByCurrency,
  takeLeadingCurrency,
  takeTrailingCurrency,
  UNSPECIFIED_CURRENCY,
} from '../../src/domain/currency';

describe('currencyCode', () => {
  it.each([
    ['SAR', 'SAR'],
    ['sar', 'SAR'],
    ['SR', 'SAR'],
    ['S.R.', 'SAR'],
    ['S.R', 'SAR'],
    ['SR.', 'SAR'],
    ['Saudi Riyal', 'SAR'],
    ['Saudi Riyals', 'SAR'],
    ['SAUDI  RIYALS', 'SAR'],
    ['Riyals', 'SAR'],
    ['ر.س', 'SAR'],
    ['ر.س.', 'SAR'],
    ['ريال', 'SAR'],
    ['ريالاً', 'SAR'],
    ['ريالات', 'SAR'],
    ['ريال سعودي', 'SAR'],
    ['ريال سعودى', 'SAR'],
    ['ریال', 'SAR'],
    ['\uFDFC', 'SAR'],
    ['\u20C1', 'SAR'],
    ['$', 'USD'],
    ['US$', 'USD'],
    ['USD', 'USD'],
    ['usd', 'USD'],
    ['US Dollar', 'USD'],
    ['U.S. Dollars', 'USD'],
    ['دولار أمريكي', 'USD'],
    ['دولار امريكي', 'USD'],
    ['€', 'EUR'],
    ['EUR', 'EUR'],
    ['Euro', 'EUR'],
    ['euros', 'EUR'],
    ['يورو', 'EUR'],
    ['AED', 'AED'],
    ['Dirham', 'AED'],
    ['UAE Dirhams', 'AED'],
    ['د.إ', 'AED'],
    ['درهم', 'AED'],
    ['درهم إماراتي', 'AED'],
    ['£', 'GBP'],
    ['GBP', 'GBP'],
    ['Pounds Sterling', 'GBP'],
    ['جنيه إسترليني', 'GBP'],
    ['  SAR  ', 'SAR'],
  ])('reads %s as %s', (text, code) => {
    expect(currencyCode(text)).toBe(code);
  });

  it.each(['', 'QAR', 'Sr', 'sr', 'Dollar', 'C$', 'SARL', 'SAR 100', 'riyal sign', 'ريال قطري'])(
    'is null for %s',
    (text) => {
      expect(currencyCode(text)).toBeNull();
    },
  );
});

describe('detectCurrency', () => {
  it.each([
    ['Amount (SAR)', 'SAR'],
    ['Unit Rate (SR)', 'SAR'],
    ['Rate S.R.', 'SAR'],
    ['Total in Saudi Riyals', 'SAR'],
    ['Price (USD)', 'USD'],
    ['Total $', 'USD'],
    ['Cost in US Dollars', 'USD'],
    ['Price (€)', 'EUR'],
    ['Amount in Euro', 'EUR'],
    ['Fee AED', 'AED'],
    ['Fee in Dirhams', 'AED'],
    ['Royalty (£)', 'GBP'],
    ['المبلغ (ر.س)', 'SAR'],
    ['السعر بالريال السعودي', 'SAR'],
    ['الإجمالي بالريالات', 'SAR'],
    ['القيمة بالدولار الأمريكي', 'USD'],
    ['السعر باليورو', 'EUR'],
    ['المبلغ د.إ', 'AED'],
    ['1,000SAR', 'SAR'],
    ['SAR1,000', 'SAR'],
  ])('finds the currency in %s', (text, code) => {
    expect(detectCurrency(text)).toBe(code);
  });

  it.each([
    '',
    'Description',
    'Quantity',
    'SR. NO.',
    'SR NO',
    'S.R. No.',
    'SR#',
    'Sr. Engineer',
    'CLASSROOM',
    'SARL company',
    'European standard EN 206',
    'C$ 100',
    'A$ 100',
    'Unit',
    'رقم البند',
  ])('finds no currency in %s', (text) => {
    expect(detectCurrency(text)).toBeNull();
  });

  it('returns the first currency mentioned', () => {
    expect(detectCurrency('USD 45,000 (SAR 168,750)')).toBe('USD');
    expect(detectCurrency('SAR 168,750 (USD 45,000)')).toBe('SAR');
  });

  it('still finds a currency next to a serial-number header', () => {
    expect(detectCurrency('SR. NO. | Amount SR')).toBe('SAR');
  });
});

describe('detectCurrencies', () => {
  it('lists each currency once, in order of first mention', () => {
    expect(detectCurrencies('Rate (SAR) / Rate ($) / Total SAR / Total €')).toEqual(['SAR', 'USD', 'EUR']);
  });

  it('is empty when there is no currency', () => {
    expect(detectCurrencies('Item / Description / Qty')).toEqual([]);
  });
});

describe('takeLeadingCurrency and takeTrailingCurrency', () => {
  it('split a leading currency from the amount', () => {
    expect(takeLeadingCurrency('SAR 1,250,000.00')).toEqual({ code: 'SAR', rest: '1,250,000.00' });
    expect(takeLeadingCurrency('$1,200')).toEqual({ code: 'USD', rest: '1,200' });
    expect(takeLeadingCurrency('SR. 500')).toEqual({ code: 'SAR', rest: '500' });
    expect(takeLeadingCurrency('€ 3,400.50')).toEqual({ code: 'EUR', rest: '3,400.50' });
  });

  it('keep the dot of a decimal after a symbol', () => {
    expect(takeLeadingCurrency('$.50')).toEqual({ code: 'USD', rest: '.50' });
  });

  it('split a trailing currency from the amount', () => {
    expect(takeTrailingCurrency('1,250,000 SAR')).toEqual({ code: 'SAR', rest: '1,250,000' });
    expect(takeTrailingCurrency('1,000 ريال')).toEqual({ code: 'SAR', rest: '1,000' });
    expect(takeTrailingCurrency('1.5 مليون ريال سعودي')).toEqual({ code: 'SAR', rest: '1.5 مليون' });
  });

  it('are null when the text does not start or end with a currency', () => {
    expect(takeLeadingCurrency('1,000 SAR')).toBeNull();
    expect(takeTrailingCurrency('SAR 1,000')).toBeNull();
    expect(takeTrailingCurrency('Total SARL')).toBeNull();
  });
});

describe('isCurrencyCode', () => {
  it('accepts only the canonical codes', () => {
    for (const code of CURRENCY_CODES) expect(isCurrencyCode(code)).toBe(true);
    expect(isCurrencyCode('SR')).toBe(false);
    expect(isCurrencyCode('sar')).toBe(false);
    expect(isCurrencyCode('QAR')).toBe(false);
  });
});

describe('currencyKey', () => {
  it('files aliases under their code, other text upper-cased and no currency under UNSPECIFIED', () => {
    expect(currencyKey('SR')).toBe('SAR');
    expect(currencyKey(' usd ')).toBe('USD');
    expect(currencyKey('qar')).toBe('QAR');
    expect(currencyKey(null)).toBe(UNSPECIFIED_CURRENCY);
    expect(currencyKey('  ')).toBe(UNSPECIFIED_CURRENCY);
  });
});

describe('sumByCurrency', () => {
  it('never adds different currencies together', () => {
    const totals = sumByCurrency([
      { amount: 1_000_000, currency: 'SAR' },
      { amount: 45_000, currency: 'USD' },
      { amount: 250_000.5, currency: 'SAR' },
      { amount: 3_400.5, currency: 'EUR' },
    ]);
    expect(totals).toEqual({ SAR: 1_250_000.5, USD: 45_000, EUR: 3_400.5 });
  });

  it('groups amounts with no currency under UNSPECIFIED', () => {
    const totals = sumByCurrency([
      { amount: 100, currency: null },
      { amount: 50, currency: 'SAR' },
      { amount: 25, currency: null },
      { amount: 5, currency: '  ' },
    ]);
    expect(totals).toEqual({ [UNSPECIFIED_CURRENCY]: 130, SAR: 50 });
  });

  it('puts aliases of one currency in the same total', () => {
    const totals = sumByCurrency([
      { amount: 100, currency: 'SAR' },
      { amount: 200, currency: 'SR' },
      { amount: 300, currency: 'ريال' },
      { amount: 7, currency: '$' },
      { amount: 3, currency: 'usd' },
    ]);
    expect(totals).toEqual({ SAR: 600, USD: 10 });
  });

  it('keeps unknown currencies apart under their own code', () => {
    expect(sumByCurrency([{ amount: 10, currency: 'qar' }, { amount: 5, currency: 'QAR' }])).toEqual({ QAR: 15 });
  });

  it('sums exactly to the cent', () => {
    expect(sumByCurrency([{ amount: 0.1, currency: 'SAR' }, { amount: 0.2, currency: 'SAR' }])).toEqual({ SAR: 0.3 });
    const ledger = Array.from({ length: 10_000 }, () => ({ amount: 1250.01, currency: 'SAR' }));
    expect(sumByCurrency(ledger)).toEqual({ SAR: 12_500_100 });
  });

  it('is empty for no items', () => {
    expect(sumByCurrency([])).toEqual({});
  });
});

describe('formatMoney', () => {
  it('writes the code, thousands groups and two decimals', () => {
    expect(formatMoney(1_250_000, 'SAR')).toBe('SAR 1,250,000.00');
    expect(formatMoney(3400.5, 'EUR')).toBe('EUR 3,400.50');
    expect(formatMoney(0.3, 'USD')).toBe('USD 0.30');
    expect(formatMoney(999, 'GBP')).toBe('GBP 999.00');
  });

  it('writes the canonical code for an alias', () => {
    expect(formatMoney(1000, 'SR')).toBe('SAR 1,000.00');
    expect(formatMoney(1000, '$')).toBe('USD 1,000.00');
  });

  it('keeps an unknown code as given', () => {
    expect(formatMoney(15, 'QAR')).toBe('QAR 15.00');
  });

  it('writes negative amounts with a minus sign and no negative zero', () => {
    expect(formatMoney(-1000, 'SAR')).toBe('SAR -1,000.00');
    expect(formatMoney(-0, 'SAR')).toBe('SAR 0.00');
    expect(formatMoney(-0.001, 'SAR')).toBe('SAR 0.00');
  });

  it('writes only the number when the currency is unknown', () => {
    expect(formatMoney(1_250_000, null)).toBe('1,250,000.00');
    expect(formatMoney(42, UNSPECIFIED_CURRENCY)).toBe('42.00');
  });

  it('shows large amounts in full', () => {
    expect(formatMoney(2_400_000_000, 'SAR')).toBe('SAR 2,400,000,000.00');
  });
});
