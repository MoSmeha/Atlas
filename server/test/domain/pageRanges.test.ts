import { describe, expect, it } from 'vitest';
import { toPageRanges } from '../../src/domain/pageRanges';

describe('toPageRanges', () => {
  it('merges consecutive pages and keeps gaps', () => {
    expect(toPageRanges([1, 2, 3, 7, 9, 10])).toEqual([
      { from: 1, to: 3 },
      { from: 7, to: 7 },
      { from: 9, to: 10 },
    ]);
  });

  it('sorts and drops duplicates', () => {
    expect(toPageRanges([5, 4, 4, 1])).toEqual([
      { from: 1, to: 1 },
      { from: 4, to: 5 },
    ]);
  });

  it('turns a fully scanned document into one range', () => {
    expect(toPageRanges(Array.from({ length: 300 }, (_, i) => i + 1))).toEqual([{ from: 1, to: 300 }]);
  });

  it('returns nothing for no pages', () => {
    expect(toPageRanges([])).toEqual([]);
  });
});
