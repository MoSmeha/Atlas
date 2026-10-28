import { describe, expect, it } from 'vitest';
import { sumExact } from '../../src/domain/decimal';

describe('sumExact', () => {
  it('removes binary float noise', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sumExact([0.1, 0.2])).toBe(0.3);
    expect(sumExact([1250000.1, 0.2])).toBe(1250000.3);
  });

  it('is zero for no values', () => {
    expect(sumExact([])).toBe(0);
  });

  it('keeps sub-cent digits instead of rounding them away', () => {
    expect(sumExact([12.345, 0.005])).toBe(12.35);
    expect(sumExact([0.125, 1250000.25])).toBe(1250000.375);
  });

  it('adds negative amounts and credits', () => {
    expect(sumExact([1000, -250.5, -0.5])).toBe(749);
    expect(sumExact([-0.1, -0.2])).toBe(-0.3);
  });

  it('sums a long ledger column to the cent', () => {
    const values = Array.from({ length: 10_000 }, () => 0.01);
    expect(values.reduce((total, value) => total + value, 0)).not.toBe(100);
    expect(sumExact(values)).toBe(100);
  });

  it('handles very large and very small values written in exponent form', () => {
    expect(sumExact([1e21, 1e21])).toBe(2e21);
    expect(sumExact([1.5e-7, 2.5e-7])).toBe(4e-7);
  });

  it('falls back to plain addition for NaN and infinity', () => {
    expect(sumExact([1, Number.NaN])).toBeNaN();
    expect(sumExact([1, Number.POSITIVE_INFINITY])).toBe(Number.POSITIVE_INFINITY);
  });
});
