import { describe, expect, it } from 'vitest';
import type { Source } from '@atlas/shared';
import { capSources, MAX_SOURCES } from '../../src/domain/capSources';

const rows = (document: string, sheet: string, rowFrom: number, rowTo = rowFrom): Source => ({ kind: 'excel', document, sheet, rowFrom, rowTo });
const page = (document: string, number: number): Source => ({ kind: 'pdf', document, page: number, quote: null });

describe('capSources', () => {
  it('keeps up to 25 sources as they are', () => {
    const sources = Array.from({ length: MAX_SOURCES }, (_, i) => rows('BOQ.xlsx', 'MEP', 8 + 2 * i));
    expect(MAX_SOURCES).toBe(25);
    expect(capSources(sources)).toEqual(sources);
  });

  it('merges the two closest ranges on one sheet first, keeping the order', () => {
    const sources = [rows('BOQ.xlsx', 'MEP', 21), rows('BOQ.xlsx', 'MEP', 40), rows('BOQ.xlsx', 'MEP', 23, 25), rows('BOQ.xlsx', 'Civil', 22)];
    expect(capSources(sources, 3)).toEqual([rows('BOQ.xlsx', 'MEP', 21, 25), rows('BOQ.xlsx', 'MEP', 40), rows('BOQ.xlsx', 'Civil', 22)]);
    expect(capSources(sources, 2)).toEqual([rows('BOQ.xlsx', 'MEP', 21, 40), rows('BOQ.xlsx', 'Civil', 22)]);
  });

  it('never merges ranges of different sheets or files, nor pages', () => {
    const sources = [rows('Rev0.xlsx', 'MEP', 8), rows('Rev1.xlsx', 'MEP', 9), rows('Rev0.xlsx', 'Civil', 10), page('Facade.pdf', 1), page('Facade.pdf', 2)];
    expect(capSources(sources, 3)).toEqual(sources.slice(0, 3));
  });

  it('merges many single rows into ranges that still cover every row', () => {
    const cited = Array.from({ length: 60 }, (_, i) => 8 + 3 * i);
    const sources = [page('Facade.pdf', 2), ...cited.map((row) => rows('BOQ.xlsx', 'MEP', row))];
    const capped = capSources(sources);

    expect(capped).toHaveLength(25);
    expect(capped[0]).toEqual(page('Facade.pdf', 2));
    const ranges = capped.flatMap((source) => (source.kind === 'excel' ? [source] : []));
    expect(cited.every((row) => ranges.some((range) => range.rowFrom <= row && row <= range.rowTo))).toBe(true);
    expect(ranges.every((range, i) => i === 0 || range.rowFrom > (ranges[i - 1]?.rowTo ?? 0))).toBe(true);
    // Even gaps merge evenly: the 60 rows pair up first, so no range holds more than four of them.
    expect(ranges.every((range) => range.rowTo - range.rowFrom <= 9)).toBe(true);
  });
});
