import { describe, expect, it } from 'vitest';
import { splitTables } from '../../../src/domain/tables/splitTables';
import { sheet } from './grid';

const boq = [
  ['Item', 'Description', 'Unit', 'Qty', 'Rate', 'Amount'],
  ['1.01', 'Site clearance', 'm2', 8400, 6.5, 54_600],
  ['1.02', 'Bulk excavation', 'm3', 96_000, 42, 4_032_000],
];

describe('splitTables', () => {
  it('splits two stacked tables at an empty row and a title', () => {
    const grid = sheet([
      ['Bill 1 - Earthworks'],
      ...boq,
      [null, 'Total', null, null, null, 4_086_600],
      [],
      ['Provisional Sums'],
      ['Ref', 'Description', 'Amount'],
      ['PS-1', 'Testing and commissioning', 250_000],
      ['PS-2', 'Utility connections', 400_000],
    ]);
    const blocks = splitTables(grid);
    expect(blocks.map((block) => ({ top: block.area.top, bottom: block.area.bottom, titles: block.titleRows }))).toEqual([
      { top: 1, bottom: 5, titles: [0] },
      { top: 7, bottom: 9, titles: [6] },
    ]);
    expect(blocks[1]?.header.roles.slice(0, 3)).toEqual(['item_code', 'description', 'amount']);
  });

  it('splits a table without known labels when its labels stand over values', () => {
    const grid = sheet([
      ...boq,
      [],
      ['Milestone', 'Due', 'Share'],
      ['Mobilisation', new Date(Date.UTC(2026, 0, 15)), '10%'],
      ['Substructure complete', new Date(Date.UTC(2026, 8, 30)), '25%'],
    ]);
    expect(splitTables(grid).map((block) => block.header.top)).toEqual([0, 4]);
  });

  it('keeps one table when the header repeats after a page break', () => {
    const grid = sheet([...boq, [], ...boq, ['1.03', 'Fill', 'm3', 1850, 46.5, 86_025]]);
    const blocks = splitTables(grid);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.repeatedHeaders).toEqual([4]);
  });

  it('keeps text rows after an empty row in the same table', () => {
    const grid = sheet([...boq, [], ['Note', 'Rates include delivery to site'], ['1.03', 'Fill', 'm3', 1850, 46.5, 86_025]]);
    expect(splitTables(grid)).toHaveLength(1);
  });

  it('splits tables side by side at an empty column', () => {
    const grid = sheet([
      ['Description', 'Amount', null, 'Description', 'Amount'],
      ['Concrete', 1000, null, 'Steel', 2000],
      ['Formwork', 500, null, 'Blockwork', 700],
    ]);
    expect(splitTables(grid).map((block) => [block.area.left, block.area.right])).toEqual([
      [0, 1],
      [3, 4],
    ]);
  });

  it('keeps one table across an empty spacer column', () => {
    const grid = sheet([
      ['Item', 'Description', 'Unit', null, 'Rate', 'Amount'],
      ['1.01', 'Site clearance', 'm2', null, 6.5, 54_600],
      ['1.02', 'Bulk excavation', 'm3', null, 42, 4_032_000],
    ]);
    expect(splitTables(grid).map((block) => [block.area.left, block.area.right])).toEqual([[0, 5]]);
  });

  it('finds no table on an empty sheet', () => {
    expect(splitTables(sheet([]))).toEqual([]);
  });
});
