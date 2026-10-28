import ExcelJS from 'exceljs';
import { beforeAll, describe, expect, it } from 'vitest';
import { provisionalSumsFacts } from '../../scripts/samples/expectedTables';
import { layoutProvisionalSums, writeProvisionalSums } from '../../scripts/samples/provisionalSums';
import { parseMoney } from '../../src/domain/money';

const layout = layoutProvisionalSums();
const facts = provisionalSumsFacts(layout);
let sheet: ExcelJS.Worksheet;

beforeAll(async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await writeProvisionalSums(layout)) as unknown as ExcelJS.Buffer);
  sheet = workbook.getWorksheet('Provisional Sums')!;
});

describe('Provisional_Sums.xlsx', () => {
  it('types every amount as a text cell, including short forms and Arabic-Indic digits', () => {
    for (const item of facts.items) expect(sheet.getCell(`C${item.row}`).value).toBe(item.text);
    const texts = facts.items.map((item) => item.text);
    expect(texts).toContain('SAR 1.2M');
    expect(texts).toContain('SAR 850K');
    expect(texts.filter((text) => /[٠-٩]/.test(text)).length).toBeGreaterThanOrEqual(2);
  });

  it('has one Arabic description', () => {
    expect(facts.arabicDescriptions).toEqual(['PS-03']);
    const row = facts.items.find((item) => item.ref === 'PS-03')!.row;
    expect(sheet.getCell(`B${row}`).value).toMatch(/\p{Script=Arabic}/u);
  });

  it('gives amounts that the money parser reads from the text exactly', () => {
    for (const item of facts.items) expect(parseMoney(item.text), item.text).toEqual({ amount: item.amount, currency: 'SAR' });
  });

  it('totals the parsed amounts in SAR and lists those above SAR 1M', () => {
    const cents = facts.items.reduce((sum, item) => sum + Math.round(item.amount * 100), 0);
    expect(facts.totals).toEqual([{ currency: 'SAR', amount: cents / 100 }]);
    expect(facts.aboveSar1m.map((item) => item.ref)).toEqual(['PS-01', 'PS-04', 'PS-06']);
  });
});
