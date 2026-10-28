import ExcelJS from 'exceljs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { buildLedger, layoutLedger, writeCostLedger } from '../../scripts/samples/costLedger';
import { ledgerFacts } from '../../scripts/samples/expectedTables';
import { day } from '../../scripts/samples/lib/dates';

const layout = layoutLedger();
const facts = ledgerFacts(layout);
let bytes: Uint8Array;
let sheet: ExcelJS.Worksheet;

beforeAll(async () => {
  bytes = await writeCostLedger(layout);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  sheet = workbook.getWorksheet('Ledger')!;
});

describe('Cost_Ledger_10k.xlsx', () => {
  it('has the header in row 1 and exactly 10,000 data rows below it', () => {
    expect((sheet.getRow(1).values as unknown[]).slice(1)).toEqual(['Date', 'Cost Code', 'Description', 'Vendor', 'Amount (SAR)']);
    expect(sheet.rowCount).toBe(10_001);
    expect(sheet.actualRowCount).toBe(10_001);
    expect(facts.dataRows).toBe(10_000);
    expect([facts.firstDataRow, facts.lastDataRow]).toEqual([2, 10_001]);
  });

  it('reads back every row as written, with real dates and numeric amounts', () => {
    let cents = 0;
    let above = 0;
    for (const entry of layout.entries) {
      const row = sheet.getRow(entry.row);
      expect(row.getCell(1).value).toEqual(day(entry.date));
      expect(row.getCell(2).value).toBe(entry.costCode);
      expect(row.getCell(5).value).toBe(entry.amount);
      cents += Math.round((row.getCell(5).value as number) * 100);
      if ((row.getCell(5).value as number) > 1_000_000) above++;
    }
    expect(cents / 100).toBe(facts.totals[0]!.amount);
    expect(above).toBe(facts.rowsAboveSar1m.count);
  });

  it('has rows above SAR 1M, one row exactly at it, credit notes and dates in order', () => {
    expect(facts.rowsAboveSar1m.count).toBeGreaterThanOrEqual(5);
    expect(facts.rowsAtExactlySar1m.map((entry) => entry.row)).toEqual([6_002]);
    expect(facts.creditNotes.count).toBeGreaterThan(0);
    const dates = layout.entries.map((entry) => entry.date);
    expect([...dates].sort()).toEqual(dates);
    expect(facts.byCostCode.reduce((sum, code) => sum + code.rows, 0)).toBe(10_000);
  });

  it('generates the same rows and bytes every time', async () => {
    expect(buildLedger()).toEqual(layout.entries);
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2031-06-15T09:30:00Z'));
      expect(Buffer.from(await writeCostLedger(layout)).equals(Buffer.from(bytes))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
