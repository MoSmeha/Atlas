import { describe, expect, it } from 'vitest';
import { describePages, toPageRanges } from '../../src/domain/pageRanges';

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

describe('describePages', () => {
  it('names one page', () => {
    expect(describePages([3])).toBe('page 3');
    expect(describePages([3, 3])).toBe('page 3');
  });

  it('names a run of three or more pages as a range', () => {
    expect(describePages([5, 3, 4])).toBe('pages 3 to 5');
  });

  it('names two neighbouring pages one by one', () => {
    expect(describePages([3, 4])).toBe('pages 3 and 4');
  });

  it('joins ranges and single pages with commas and "and"', () => {
    expect(describePages([2, 4])).toBe('pages 2 and 4');
    expect(describePages([1, 2, 3, 7, 9, 10])).toBe('pages 1 to 3, 7, 9 and 10');
  });
});
