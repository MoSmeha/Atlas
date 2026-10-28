import { describe, expect, it } from 'vitest';
import { reciprocalRankFusion } from '../../src/domain/ranking';

describe('reciprocalRankFusion', () => {
  it('scores each id by 1 / (k + rank) summed over the lists', () => {
    const fused = reciprocalRankFusion([
      ['a', 'b', 'c'],
      ['c', 'a'],
    ]);
    expect(fused.map((item) => item.id)).toEqual(['a', 'c', 'b']);
    expect(fused[0]?.score).toBeCloseTo(1 / 61 + 1 / 62);
    expect(fused[1]?.score).toBeCloseTo(1 / 63 + 1 / 61);
    expect(fused[2]?.score).toBeCloseTo(1 / 62);
  });

  it('reports what each list contributed, with 0 where a list missed the id', () => {
    const fused = reciprocalRankFusion([['a', 'b'], ['b']]);
    const byId = new Map(fused.map((item) => [item.id, item.contributions]));
    expect(byId.get('a')).toEqual([1 / 61, 0]);
    expect(byId.get('b')).toEqual([1 / 62, 1 / 61]);
  });

  it('ranks an id found by both lists above ids found by one', () => {
    const fused = reciprocalRankFusion([
      ['keyword-only', 'shared'],
      ['semantic-only', 'shared'],
    ]);
    expect(fused[0]?.id).toBe('shared');
  });

  it('uses the given k', () => {
    const [top] = reciprocalRankFusion([[7]], 1);
    expect(top).toEqual({ id: 7, score: 0.5, contributions: [0.5] });
  });

  it('counts an id repeated in one list once, at its best rank', () => {
    const [top] = reciprocalRankFusion([['a', 'a', 'a']]);
    expect(top?.score).toBeCloseTo(1 / 61);
  });

  it('breaks ties by the order ids were first seen', () => {
    const fused = reciprocalRankFusion([['x'], ['y'], ['z']]);
    expect(fused.map((item) => item.id)).toEqual(['x', 'y', 'z']);
  });

  it('returns nothing for empty lists', () => {
    expect(reciprocalRankFusion([])).toEqual([]);
    expect(reciprocalRankFusion([[], []])).toEqual([]);
  });

  it('refuses a k that is not positive', () => {
    expect(() => reciprocalRankFusion([['a']], 0)).toThrow(RangeError);
    expect(() => reciprocalRankFusion([['a']], Number.NaN)).toThrow(RangeError);
  });
});
