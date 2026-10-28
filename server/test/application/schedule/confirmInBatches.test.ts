import { describe, expect, it } from 'vitest';
import { splitBatches } from '../../../src/application/schedule/confirmInBatches';

function sizes(count: number): number[] {
  return splitBatches(Array.from({ length: count }, (_, i) => i)).map((batch) => batch.length);
}

describe('splitBatches', () => {
  it('keeps a small set in one call and splits a larger one into up to three nearly equal calls', () => {
    expect(sizes(0)).toEqual([]);
    expect(sizes(29)).toEqual([29]);
    expect(sizes(61)).toEqual([31, 30]);
    expect(sizes(158)).toEqual([53, 53, 52]);
    expect(sizes(450)).toEqual([150, 150, 150]);
  });

  it('never puts more than 150 in one call', () => {
    expect(sizes(451)).toEqual([113, 113, 113, 112]);
  });

  it('keeps the order', () => {
    expect(splitBatches([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).flat()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
