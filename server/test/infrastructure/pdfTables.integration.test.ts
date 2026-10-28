import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildBoqPhase2Facade } from '../../scripts/samples/boqPhase2Facade';
import { phase2BoqFacts } from '../../scripts/samples/expectedTables';
import type { ReadOutcome } from '../../src/application/ports/DocumentReader';
import { sumExact } from '../../src/domain/decimal';
import type { PdfPage } from '../../src/domain/document';
import type { CleanTable } from '../../src/domain/table';
import { extractPdfTables } from '../../src/domain/tables/pdfTables';
import { MupdfReader } from '../../src/infrastructure/readers/MupdfReader';
import { type TextItem, textPdf, writePdf } from './pdfFixtures';

let dir: string;
let width: (text: string, size: number) => number;
const reader = new MupdfReader();

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'atlas-pdf-tables-'));
  const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
  width = (text, size) => font.widthOfTextAtSize(text, size);
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

function pagesOf(outcome: ReadOutcome): PdfPage[] {
  if (outcome.status !== 'ok' || outcome.document.kind !== 'pdf') throw new Error(`Expected a readable PDF, got ${outcome.status}`);
  return outcome.document.pages;
}

function only(tables: CleanTable[]): CleanTable {
  expect(tables).toHaveLength(1);
  return tables[0] as CleanTable;
}

const SIZE = 9;
/** Item, description and unit start at their x; quantity, rate and amount end at theirs. */
const LEFT = { item: 40, description: 85, unit: 330 };
const RIGHT = { quantity: 405, rate: 475, amount: 555 };

/** One BOQ row with its baseline `y` points from the top; '' leaves a cell empty. */
function row(y: number, [item, description, unit, quantity, rate, amount]: readonly string[]): TextItem[] {
  const left = (text = '', x: number) => (text === '' ? [] : [{ text, x, y, size: SIZE }]);
  const right = (text = '', x: number) => (text === '' ? [] : [{ text, x: x - width(text, SIZE), y, size: SIZE }]);
  return [
    ...left(item, LEFT.item),
    ...left(description, LEFT.description),
    ...left(unit, LEFT.unit),
    ...right(quantity, RIGHT.quantity),
    ...right(rate, RIGHT.rate),
    ...right(amount, RIGHT.amount),
  ];
}

/** The header with every label left-aligned at a fixed x, so numbers end past their label. */
function header(y: number): TextItem[] {
  const labels: [string, number][] = [['Item', 40], ['Description', 85], ['Unit', 330], ['Qty', 370], ['Rate (SAR)', 420], ['Amount (SAR)', 490]];
  return labels.map(([text, x]) => ({ text, x, y, size: SIZE }));
}

function footer(page: number): TextItem[] {
  const label = `Page ${page} of 2`;
  return [
    { text: 'Fictional sample document generated for testing Atlas.', x: 40, y: 810, size: 8 },
    { text: label, x: RIGHT.amount - width(label, 8), y: 810, size: 8 },
  ];
}

describe('extractPdfTables on PDFs read by MupdfReader', () => {
  it('extracts a two-page BOQ drawn at fixed columns', async () => {
    const bytes = await textPdf([
      {
        items: [
          { text: 'Najd Gate Mixed-Use Tower', x: 40, y: 60, size: 14 },
          { text: 'Bill No. 5 - Mechanical Services', x: 40, y: 80, size: 11 },
          ...header(110),
          ...row(130, ['5.1', 'CHILLED WATER PLANT']),
          ...row(150, ['5.1.01', 'Air-cooled screw chillers, 1,200 kW, with', 'nr', '3', '1,850,000.00', '5,550,000.00']),
          ...row(161, ['', 'integral controls and anti-vibration mounts']),
          ...row(181, ['5.1.02', 'Chilled water pumps, 75 kW', 'nr', '4', '96,500.00', '386,000.00']),
          ...row(201, ['5.1.03', 'Pre-insulated chilled water pipework', 'm', '1,240', '385.00', '477,400.00']),
          ...row(221, ['', 'Carried forward', '', '', '', '6,413,400.00']),
          ...footer(1),
        ],
      },
      {
        items: [
          { text: 'Najd Gate Mixed-Use Tower | Bill No. 5 - Mechanical Services', x: 40, y: 40, size: 8 },
          ...header(70),
          ...row(90, ['', 'Brought forward', '', '', '', '6,413,400.00']),
          ...row(110, ['5.2', 'AIR DISTRIBUTION']),
          ...row(130, ['5.2.01', 'Air handling units, 12 m3/s', 'nr', '6', '245,000.00', '1,470,000.00']),
          ...row(150, ['5.2.02', 'Galvanised steel ductwork', 'kg', '38,500', '18.50', '712,250.00']),
          ...row(170, ['', 'Total carried to Summary', '', '', '', '8,595,650.00']),
          { text: 'The rates above include supply, installation, testing and commissioning of the complete systems.', x: 40, y: 230, size: SIZE },
          ...footer(2),
        ],
      },
    ]);
    const table = only(extractPdfTables(pagesOf(await reader.read(writePdf(join(dir, 'boq.pdf'), bytes)))));

    expect(table).toMatchObject({
      title: 'Najd Gate Mixed-Use Tower - Bill No. 5 - Mechanical Services',
      sheet: null,
      pageFrom: 1,
      pageTo: 2,
      currency: 'SAR',
    });
    expect(table.columns.map(({ name, type }) => [name, type])).toEqual([
      ['item_code', 'text'],
      ['description', 'text'],
      ['unit', 'text'],
      ['quantity', 'integer'],
      ['rate', 'number'],
      ['amount', 'integer'],
    ]);
    const chillers = '5.1 CHILLED WATER PLANT';
    const air = '5.2 AIR DISTRIBUTION';
    expect(table.rows.map((r) => [r.page, ...r.values, r.section, r.isTotal])).toEqual([
      [1, '5.1.01', 'Air-cooled screw chillers, 1,200 kW, with integral controls and anti-vibration mounts', 'nr', 3, 1_850_000, 5_550_000, chillers, false],
      [1, '5.1.02', 'Chilled water pumps, 75 kW', 'nr', 4, 96_500, 386_000, chillers, false],
      [1, '5.1.03', 'Pre-insulated chilled water pipework', 'm', 1240, 385, 477_400, chillers, false],
      [1, null, 'Carried forward', null, null, null, 6_413_400, chillers, true],
      [2, null, 'Brought forward', null, null, null, 6_413_400, null, true],
      [2, '5.2.01', 'Air handling units, 12 m3/s', 'nr', 6, 245_000, 1_470_000, air, false],
      [2, '5.2.02', 'Galvanised steel ductwork', 'kg', 38_500, 18.5, 712_250, air, false],
      [2, null, 'Total carried to Summary', null, null, null, 8_595_650, air, true],
    ]);
    expect(table.rows.every((r) => r.sheetRow === null)).toBe(true);
  });

  it('matches the facts of the generated Phase 2 facade BOQ', async () => {
    const pdf = await buildBoqPhase2Facade();
    const facts = phase2BoqFacts(pdf);
    const table = only(extractPdfTables(pagesOf(await reader.read(writePdf(join(dir, pdf.fileName), pdf.bytes)))));
    const items = table.rows.filter((r) => !r.isTotal);
    const totals = table.rows.filter((r) => r.isTotal);
    const amount = (r: (typeof table.rows)[number]) => r.values[5] as number;

    expect(table).toMatchObject({ pageFrom: 1, pageTo: facts.pages, currency: facts.currency });
    expect(items).toHaveLength(facts.itemRows);
    expect(items.map((r) => [r.page, r.values[0], r.values[1], r.values[2], r.values[3], r.values[4], amount(r)])).toEqual(
      facts.items.map((item) => [item.page, item.item, item.description, item.unit, item.quantity, item.rate, item.amount]),
    );
    expect(items.every((r, i) => r.section?.startsWith(`${facts.items[i]?.section} `))).toBe(true);
    expect(sumExact(items.map(amount))).toBe(facts.totals[0]?.amount);
    expect(totals.map((r) => [r.page, r.values[1], amount(r)])).toEqual([
      ...facts.carriedForward.flatMap((carried, i) => {
        const brought = facts.broughtForward[i];
        const rows: unknown[][] = [[carried.page, 'Carried forward', carried.amount]];
        if (brought !== undefined) rows.push([brought.page, 'Brought forward', brought.amount]);
        return rows;
      }),
      [facts.pages, facts.statedTotal.label, facts.statedTotal.amount],
    ]);
  });
});
