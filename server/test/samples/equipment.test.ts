import ExcelJS from 'exceljs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { layoutEquipment, writeEquipmentImports } from '../../scripts/samples/equipmentImports';
import { equipmentFacts } from '../../scripts/samples/expectedTables';

const layout = layoutEquipment();
const facts = equipmentFacts(layout);
let workbook: ExcelJS.Workbook;

beforeAll(async () => {
  workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await writeEquipmentImports(layout)) as unknown as ExcelJS.Buffer);
});

const isEmptyRow = (sheet: ExcelJS.Worksheet, row: number) =>
  (sheet.getRow(row).values as unknown[]).every((value) => value === undefined || value === null || value === '');

describe('Equipment_Imports.xlsx', () => {
  it('puts a USD table and a EUR table on one sheet, separated by empty rows, and AED on a second sheet', () => {
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Imported Equipment', 'Regional Supply']);
    const [usd, eur, aed] = facts.tables;
    expect([usd?.currency, eur?.currency, aed?.currency]).toEqual(['USD', 'EUR', 'AED']);
    expect(usd?.sheet).toBe(eur?.sheet);
    const sheet = workbook.getWorksheet('Imported Equipment')!;
    const gap = [];
    for (let row = usd!.statedTotal.source.rowFrom + 1; row < eur!.titleRow!; row++) gap.push(row);
    expect(gap.length).toBeGreaterThanOrEqual(1);
    for (const row of gap) expect(isEmptyRow(sheet, row), `row ${row}`).toBe(true);
  });

  it('gives each table its own title and a header naming its currency', () => {
    for (const table of facts.tables) {
      const sheet = workbook.getWorksheet(table.sheet)!;
      expect(sheet.getCell(`A${table.titleRow}`).value).toBe(table.title);
      expect(sheet.getCell(`G${table.headerRow}`).value).toBe(`Unit Price (${table.currency})`);
      expect(sheet.getCell(`H${table.headerRow}`).value).toBe(`Amount (${table.currency})`);
    }
  });

  it('writes amounts as quantity x price formulas and totals as SUM formulas with cached results', () => {
    for (const table of facts.tables) {
      const sheet = workbook.getWorksheet(table.sheet)!;
      for (const item of table.items) {
        expect(sheet.getCell(`H${item.row}`).value).toEqual({ formula: `E${item.row}*G${item.row}`, result: item.amount });
      }
      const totalRow = table.statedTotal.source.rowFrom;
      expect(sheet.getCell(`B${totalRow}`).value).toBe(table.statedTotal.label);
      expect(sheet.getCell(`H${totalRow}`).value).toEqual({
        formula: `SUM(H${table.source.rowFrom}:H${table.source.rowTo})`,
        result: table.total.amount,
      });
    }
  });

  it('keeps one total per currency and never a mixed one', () => {
    expect(facts.totalsByCurrency.map((total) => total.currency)).toEqual(['USD', 'EUR', 'AED']);
    for (const total of facts.totalsByCurrency) {
      const tables = facts.tables.filter((table) => table.currency === total.currency);
      const cents = tables.flatMap((table) => table.items).reduce((sum, item) => sum + Math.round(item.amount * 100), 0);
      expect(Math.round(total.amount * 100)).toBe(cents);
    }
  });

  it('gives the same bytes every time', async () => {
    const first = await writeEquipmentImports(layout);
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2031-06-15T09:30:00Z'));
      expect(Buffer.from(await writeEquipmentImports(layout)).equals(Buffer.from(first))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
