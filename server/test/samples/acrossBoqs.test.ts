import { beforeAll, describe, expect, it } from 'vitest';
import { buildExpected, type Expected } from '../../scripts/samples/expected';
import { buildSampleSet } from '../../scripts/samples/sampleSet';

let expected: Expected;

beforeAll(async () => {
  expected = buildExpected(await buildSampleSet());
});

describe('items above SAR 1M across all BOQs', () => {
  it('lists only SAR item rows strictly above the threshold, each with a source', () => {
    const list = expected.itemsAboveSar1mAcrossBoqs;
    expect(list.items.length).toBeGreaterThan(0);
    for (const item of list.items) {
      expect(item.amount).toBeGreaterThan(1_000_000);
      expect(item.currency).toBe('SAR');
      expect(item.source.document).toBe(item.file);
    }
    expect(Object.keys(list.countByFile)).toEqual(['BOQ_Phase1_Rev0.xlsx', 'BOQ_Phase1_Rev1.xlsx', 'BOQ_Phase2_Facade.pdf']);
    expect(list.items.some((item) => item.file === 'Equipment_Imports.xlsx')).toBe(false);
  });

  it('agrees with the per-file lists and gives PDF items their page', () => {
    const list = expected.itemsAboveSar1mAcrossBoqs;
    const phase1 = expected.rowsAboveSar1m.map((row) => `${row.file}|${row.item}`);
    const phase2 = expected.boqPhase2.rowsAboveSar1m.map((row) => `${row.file}|${row.item}`);
    expect(list.items.map((item) => `${item.file}|${item.item}`)).toEqual([...phase1, ...phase2]);
    for (const item of list.items.filter((entry) => entry.source.kind === 'pdf')) {
      const row = expected.boqPhase2.rowsAboveSar1m.find((entry) => entry.item === item.item)!;
      expect(item.source).toEqual(row.source);
    }
  });

  it('keeps one revision per bill in latestRevisions and leaves out the item at exactly SAR 1M', () => {
    const latest = expected.itemsAboveSar1mAcrossBoqs.latestRevisions;
    expect(latest.files).toEqual(['BOQ_Phase1_Rev1.xlsx', 'BOQ_Phase2_Facade.pdf']);
    expect(latest.items.every((item) => latest.files.includes(item.file))).toBe(true);
    expect(latest.count).toBe(latest.items.length);
    expect(expected.itemsAboveSar1mAcrossBoqs.items.some((item) => item.item === '4.2.05')).toBe(false);
  });
});
