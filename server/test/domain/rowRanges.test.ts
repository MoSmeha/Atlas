import { describe, expect, it } from 'vitest';
import { rowRanges } from '../../src/domain/rowRanges';

/** Rows 5 to 20 of a sheet. */
const contiguous = Array.from({ length: 16 }, (_, i) => 5 + i);

describe('rowRanges', () => {
  it('merges consecutive rows and keeps gaps where uncited table rows lie', () => {
    expect(rowRanges([5, 6, 7, 10, 12, 13], contiguous)).toEqual([
      { from: 5, to: 7 },
      { from: 10, to: 10 },
      { from: 12, to: 13 },
    ]);
  });

  it('sorts and drops duplicates', () => {
    expect(rowRanges([9, 7, 8, 8], contiguous)).toEqual([{ from: 7, to: 9 }]);
  });

  it('bridges blank and heading rows that are not table rows', () => {
    const table = [5, 6, 7, 10, 11, 12, 15];
    expect(rowRanges([5, 6, 7, 10, 11, 12, 15], table)).toEqual([{ from: 5, to: 15 }]);
  });

  it('splits at a table row that was not cited, such as a sub-total', () => {
    const table = [5, 6, 7, 8, 10, 11];
    expect(rowRanges([5, 6, 7, 10, 11], table)).toEqual([
      { from: 5, to: 7 },
      { from: 10, to: 11 },
    ]);
  });

  it('only merges by adjacency for rows the table does not hold', () => {
    expect(rowRanges([3, 4, 9], contiguous)).toEqual([
      { from: 3, to: 4 },
      { from: 9, to: 9 },
    ]);
    expect(rowRanges([5, 6, 8], [])).toEqual([
      { from: 5, to: 6 },
      { from: 8, to: 8 },
    ]);
  });

  it('returns nothing for no rows', () => {
    expect(rowRanges([], contiguous)).toEqual([]);
  });
});
