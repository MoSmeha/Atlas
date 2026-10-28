import ExcelJS from 'exceljs';
import { describe, expect, it, vi } from 'vitest';
import { boqPhase1Rev0 } from '../../scripts/samples/boqPhase1Rev0';
import { boqPhase1Rev1, boqPhase1Rev1Changes } from '../../scripts/samples/boqPhase1Rev1';
import { layoutBoq } from '../../scripts/samples/lib/boqLayout';
import { writeBoqWorkbook } from '../../scripts/samples/lib/boqWorkbook';
import { reviseBoq } from '../../scripts/samples/lib/reviseBoq';
import { diffRevisions } from '../../scripts/samples/lib/revisionDiff';
import { FOOTER_TEXT } from '../../scripts/samples/project';

const rev0 = layoutBoq(boqPhase1Rev0);
const rev1 = layoutBoq(boqPhase1Rev1);
const items = (layout: typeof rev0) => layout.bills.flatMap((bill) => bill.items);

describe('Phase 1 BOQ layout', () => {
  it('has three bills of 12 to 25 items, with items above and below SAR 1,000,000', () => {
    for (const bill of rev0.bills) {
      expect(bill.items.length).toBeGreaterThanOrEqual(12);
      expect(bill.items.length).toBeLessThanOrEqual(25);
      expect(bill.items.some((line) => line.amount > 1_000_000)).toBe(true);
      expect(bill.items.some((line) => line.amount < 1_000_000)).toBe(true);
    }
  });

  it('plants exactly three arithmetic errors and one wrong sub-total in Rev0', () => {
    const errors = items(rev0).filter((line) => line.amount !== line.correctAmount);
    expect(errors.map((line) => line.item.code)).toEqual(['1.1.05', '2.3.02', '3.1.07']);
    expect(errors.every((line) => line.formula === null)).toBe(true);
    const wrong = rev0.bills.flatMap((bill) => bill.subtotals).filter((line) => line.value !== line.correctValue);
    expect(wrong.map((line) => line.section.code)).toEqual(['1.2']);
  });

  it('places the header on rows 5 and 6 and every item after it, in order', () => {
    for (const bill of rev0.bills) {
      const rows = bill.lines.map((line) => line.row);
      expect(rows[0]).toBe(7);
      expect([...rows].sort((a, b) => a - b)).toEqual(rows);
      expect(bill.total.row).toBe(Math.max(...rows));
      expect(bill.footerRow).toBeGreaterThan(bill.total.row);
    }
  });

  it('makes each bill total the sum of its sub-totals', () => {
    const substructure = rev0.bills[0]!;
    expect(substructure.total.formula).toBe(substructure.subtotals.map((line) => `F${line.row}`).join('+'));
    expect(substructure.total.correctValue - substructure.total.value).toBe(117_000);
  });
});

describe('Phase 1 BOQ Rev1', () => {
  it('changes four quantities and three rates, adds two items, removes one and fixes one error', () => {
    const diff = diffRevisions(rev0, rev1);
    expect(diff.changed.filter((c) => c.changed.includes('quantity')).map((c) => c.item)).toEqual(
      Object.keys(boqPhase1Rev1Changes.quantities),
    );
    expect(diff.changed.filter((c) => c.changed.includes('rate')).map((c) => c.item)).toEqual(
      Object.keys(boqPhase1Rev1Changes.rates),
    );
    expect(diff.added.map((a) => a.item)).toEqual(['2.3.07', '3.2.07']);
    expect(diff.removed.map((r) => r.item)).toEqual(['3.4.02']);
    expect(diff.changed.filter((c) => c.changed.join() === 'amount').map((c) => c.item)).toEqual(['2.3.02']);
    expect(items(rev1).filter((line) => line.amount !== line.correctAmount)).toHaveLength(2);
  });

  it('keeps the total delta equal to the sum of the item changes', () => {
    const diff = diffRevisions(rev0, rev1);
    const cents = (n: number) => Math.round(n * 100);
    const parts =
      diff.changed.reduce((sum, c) => sum + cents(c.amountDelta), 0) +
      diff.added.reduce((sum, a) => sum + cents(a.amount), 0) -
      diff.removed.reduce((sum, r) => sum + cents(r.amount), 0);
    expect(cents(diff.totalDelta[0]!.delta)).toBe(parts);
  });

  it('rejects a change that names an unknown item', () => {
    expect(() => reviseBoq(boqPhase1Rev0, { ...boqPhase1Rev1Changes, removed: ['9.9.99'] })).toThrow(/9\.9\.99/);
  });
});

describe('BOQ workbook', () => {
  it('writes formulas with cached results, typed error amounts, merged headers and the footer', async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await writeBoqWorkbook(rev0)) as unknown as ExcelJS.Buffer);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Summary', 'Substructure', 'Superstructure', 'MEP']);

    const sheet = workbook.getWorksheet('Substructure')!;
    expect(sheet.getCell('A3').value).toBe('Revision 0');
    expect(sheet.getCell('E5').value).toBe('Rates and Amounts (SAR)');
    expect(sheet.getCell('F6').value).toBe('Amount');
    expect(sheet.getCell('F5').isMerged).toBe(true);
    for (const line of rev0.bills[0]!.items) {
      const value = sheet.getCell(`F${line.row}`).value;
      if (line.formula === null) expect(value).toBe(line.amount);
      else expect(value).toEqual({ formula: line.formula, result: line.amount });
    }
    expect(sheet.getCell(`A${rev0.bills[0]!.footerRow}`).value).toBe(FOOTER_TEXT);

    const summary = workbook.getWorksheet('Summary')!;
    expect(summary.getCell(`C${rev0.summary.totalRow}`).value).toEqual({
      formula: rev0.summary.totalFormula,
      result: rev0.summary.total,
    });
  });

  it('gives the same bytes every time, so regenerating does not churn git', async () => {
    const first = await writeBoqWorkbook(rev1);
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2031-06-15T09:30:00Z'));
      expect(Buffer.from(await writeBoqWorkbook(rev1)).equals(Buffer.from(first))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
