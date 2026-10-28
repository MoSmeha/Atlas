import { describe, expect, it } from 'vitest';
import { cleanValue, columnType } from '../../../src/domain/tables/columnTypes';

describe('columnType', () => {
  it('is integer when every number is whole', () => {
    expect(columnType([8400, '96,000', null, 4850])).toBe('integer');
  });

  it('is number when some numbers have decimals', () => {
    expect(columnType([6.5, 'SAR 42', '58.25'])).toBe('number');
  });

  it('is number when at least 80% of the filled cells read as numbers', () => {
    expect(columnType([100, 200, 300, 400, 'Included', null, null])).toBe('integer');
  });

  it('is text below 80%', () => {
    expect(columnType([100, 200, 300, 'Included', 'Rate only'])).toBe('text');
    expect(columnType(['m2', 'm3', 'nr'])).toBe('text');
    expect(columnType([null, null])).toBe('text');
  });

  it('keeps item codes, descriptions, units and currencies as text', () => {
    expect(columnType([1, 2, 3], 'item_code')).toBe('text');
    expect(columnType([1.1, 1.2], 'description')).toBe('text');
    expect(columnType([100, 200], 'amount')).toBe('integer');
  });

  it('treats dates as text', () => {
    expect(columnType([new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2026, 1, 1))])).toBe('text');
  });
});

describe('cleanValue', () => {
  it('stores numbers in number columns and null for text that is not one', () => {
    expect(cleanValue('SAR 1.2M', 'number')).toBe(1_200_000);
    expect(cleanValue('1,250,000.00', 'integer')).toBe(1_250_000);
    expect(cleanValue('Included', 'number')).toBeNull();
    expect(cleanValue(null, 'number')).toBeNull();
  });

  it('stores text in text columns', () => {
    expect(cleanValue(1, 'text')).toBe('1');
    expect(cleanValue(new Date(Date.UTC(2026, 2, 15)), 'text')).toBe('2026-03-15');
    expect(cleanValue('   ', 'text')).toBeNull();
  });
});
