import { describe, expect, it } from 'vitest';
import type { RawCell } from '../../../src/domain/document';
import { type CurrencyColumnInfo, tableCurrency } from '../../../src/domain/tables/tableCurrency';

const description: CurrencyColumnInfo = { label: 'Description', role: 'description', type: 'text' };
const amount = (label = 'Amount'): CurrencyColumnInfo => ({ label, role: 'amount', type: 'number' });

describe('tableCurrency', () => {
  it('reads the currency from a money column header', () => {
    const rows: RawCell[][] = [['Concrete', 1000], ['Steel', 2000]];
    expect(tableCurrency([description, amount('Amount (SAR)')], rows, null)).toEqual({ currency: 'SAR', perRow: null });
  });

  it('reads the currency from the title when nothing else states one', () => {
    const rows: RawCell[][] = [['Concrete', 1000]];
    expect(tableCurrency([description, amount()], rows, 'Bill of Quantities - All amounts in Saudi Riyals')).toEqual({
      currency: 'SAR',
      perRow: null,
    });
  });

  it('reads the currency from cell prefixes', () => {
    const rows: RawCell[][] = [['Chillers', 'USD 1.2M'], ['Pumps', 'USD 96,500']];
    expect(tableCurrency([description, amount()], rows, null)).toEqual({ currency: 'USD', perRow: null });
  });

  it('keeps a currency per row when the cells mix currencies', () => {
    const rows: RawCell[][] = [['Chillers', 'USD 1,200,000'], ['Pumps', 'SAR 96,500'], ['Spares', 'EUR 3.400,50'], ['Note', null]];
    expect(tableCurrency([description, amount()], rows, null)).toEqual({ currency: null, perRow: ['USD', 'SAR', 'EUR', null] });
  });

  it('is null when uniform columns state different currencies', () => {
    const rows: RawCell[][] = [['Chillers', 1000, 270]];
    const columns = [description, amount('Amount (SAR)'), { label: 'Amount (USD)', role: null, type: 'number' } as const];
    expect(tableCurrency(columns, rows, null)).toEqual({ currency: null, perRow: null });
  });

  it('uses a currency column, as codes, filling blanks from the cells', () => {
    const columns: CurrencyColumnInfo[] = [description, amount(), { label: 'Currency', role: 'currency', type: 'text' }];
    const rows: RawCell[][] = [['Chillers', 1000, 'SR'], ['Pumps', 'USD 500', null]];
    expect(tableCurrency(columns, rows, null)).toEqual({ currency: null, perRow: ['SAR', 'USD'] });
    const same: RawCell[][] = [['Chillers', 1000, 'SR'], ['Pumps', 500, 'Saudi Riyal']];
    expect(tableCurrency(columns, same, null)).toEqual({ currency: 'SAR', perRow: ['SAR', 'SAR'] });
  });

  it('is null when no currency is stated anywhere', () => {
    expect(tableCurrency([description, amount()], [['Concrete', 1000]], 'Bill 1')).toEqual({ currency: null, perRow: null });
  });
});
