import { describe, expect, it } from 'vitest';
import { cellNumber, cellText, isBlank, isoDate, isValueCell, tidyNumber } from '../../../src/domain/tables/cellText';

describe('cellText', () => {
  it('shows each kind of cell as plain text', () => {
    expect(cellText(null)).toBe('');
    expect(cellText('  Excavation \n in rock ')).toBe('Excavation in rock');
    expect(cellText(1250000)).toBe('1250000');
    expect(cellText(6.5)).toBe('6.5');
    expect(cellText(true)).toBe('TRUE');
    expect(cellText(false)).toBe('FALSE');
  });

  it('writes dates as yyyy-mm-dd', () => {
    expect(cellText(new Date(Date.UTC(2025, 11, 28)))).toBe('2025-12-28');
    expect(isoDate(new Date(Date.UTC(2026, 0, 5, 0, 0, 0)))).toBe('2026-01-05');
    expect(isoDate(new Date(Number.NaN))).toBe('');
  });

  it('drops float noise from cached formula results', () => {
    expect(cellText(0.1 + 0.2)).toBe('0.3');
    expect(tidyNumber(1_234_567.890_000_000_1)).toBe(1_234_567.89);
  });
});

describe('cellNumber', () => {
  it.each([
    [1_250_000, 1_250_000, null],
    ['1,250,000.00', 1_250_000, null],
    ['SAR 1.2M', 1_200_000, 'SAR'],
    ['USD 3,400.50', 3400.5, 'USD'],
    ['(1,000)', -1000, null],
    ['١٬٢٥٠٬٠٠٠', 1_250_000, null],
    ['٤٥٠٫٧٥ ر.س', 450.75, 'SAR'],
    ['12%', 0.12, null],
  ])('reads %s as %s', (cell, amount, currency) => {
    expect(cellNumber(cell)).toEqual({ amount, currency });
  });

  it('is null for text, dates, booleans and long descriptions', () => {
    for (const cell of ['Included', '1.1.01', 'm2', '', null, true, new Date(Date.UTC(2025, 0, 1))]) {
      expect(cellNumber(cell)).toBeNull();
    }
    expect(cellNumber('Bored cast-in-place piles, 1200 mm diameter, 30 m deep')).toBeNull();
  });
});

describe('isBlank and isValueCell', () => {
  it('tells empty cells, values and text apart', () => {
    expect(isBlank(null)).toBe(true);
    expect(isBlank('   ')).toBe(true);
    expect(isBlank(0)).toBe(false);
    expect(isValueCell(0)).toBe(true);
    expect(isValueCell('SAR 500')).toBe(true);
    expect(isValueCell(new Date(Date.UTC(2025, 0, 1)))).toBe(true);
    expect(isValueCell('Description')).toBe(false);
    expect(isValueCell(null)).toBe(false);
  });
});
