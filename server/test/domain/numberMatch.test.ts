import { describe, expect, it } from 'vitest';
import { numberPool, poolHas, tolerance } from '../../src/domain/numberMatch';
import { extractNumbers } from '../../src/domain/numbers';

function written(text: string) {
  const [mention] = extractNumbers(text);
  if (mention === undefined) throw new Error(`no number in ${text}`);
  return mention;
}

describe('numberPool', () => {
  it('keeps finite values, unsigned and sorted', () => {
    expect(numberPool([5, -2, Number.NaN, 1, Number.POSITIVE_INFINITY])).toEqual([1, 2, 5]);
  });
});

describe('tolerance', () => {
  it('is half of the last written digit', () => {
    expect(tolerance(written('1,250,000.00'))).toBeCloseTo(0.005, 4);
    expect(tolerance(written('1,250,000'))).toBeCloseTo(0.5, 6);
    expect(tolerance(written('1.25M'))).toBeCloseTo(5000, 3);
  });

  it('is never looser than two significant digits', () => {
    expect(tolerance(written('1M'))).toBeCloseTo(50_000, 3);
    expect(tolerance(written('7'))).toBeCloseTo(0.05, 6);
  });
});

describe('poolHas', () => {
  const pool = numberPool([1_250_000, 0.15, 48_250_000.5, -3200]);

  it.each(['1250000', '1,250,000', '1,250,000.00', 'SAR 1.25M', '1.25 million', '١٬٢٥٠٬٠٠٠', '1.25 مليون'])(
    'matches %s to 1250000',
    (text) => {
      expect(poolHas(pool, written(text))).toBe(true);
    },
  );

  it('matches a value rounded the way it is written', () => {
    expect(poolHas(pool, written('SAR 48.25M'))).toBe(true);
    expect(poolHas(pool, written('48,250,000'))).toBe(true);
    expect(poolHas(pool, written('48,250,002'))).toBe(false);
  });

  it('matches a percentage to its fraction', () => {
    expect(poolHas(pool, written('15%'))).toBe(true);
    expect(poolHas(pool, written('١٥٪'))).toBe(true);
    expect(poolHas(pool, written('15'))).toBe(false);
  });

  it('ignores the sign', () => {
    expect(poolHas(pool, written('(3,200)'))).toBe(true);
    expect(poolHas(pool, written('3,200'))).toBe(true);
  });

  it('rejects numbers that are not there', () => {
    expect(poolHas(pool, written('1,300,000'))).toBe(false);
    expect(poolHas(pool, written('1.4M'))).toBe(false);
    expect(poolHas(numberPool([]), written('42'))).toBe(false);
  });
});
