import { describe, expect, it } from 'vitest';
import type { TextLine } from '../../src/domain/document';
import type { CleanTable } from '../../src/domain/table';
import { extractPdfTables } from '../../src/domain/tables/pdfTables';
import { BOQ_X, boqHeader, boqLine, line, pdfPage, text } from './pdfPage';

function only(tables: CleanTable[]): CleanTable {
  expect(tables).toHaveLength(1);
  return tables[0] as CleanTable;
}

const columnsOf = (table: CleanTable) => table.columns.map(({ name, role, type }) => ({ name, role, type }));
const valuesOf = (table: CleanTable) => table.rows.map((row) => row.values);
const descriptions = (table: CleanTable) => table.rows.map((row) => row.values[1]);

/** A running footer printed on every page. */
const footer = (page: number, pages: number): TextLine =>
  line(800, [
    { text: 'Fictional sample document.', x: 40 },
    { text: `Page ${page} of ${pages}`, x: BOQ_X.amount, right: true },
  ], 8);

/** A running header printed at the top of every page. */
const runningHeader = (): TextLine => text(40, 'Najd Gate Tower | Bill No. 4 - Facade Package', 8);

describe('extractPdfTables', () => {
  it('reads a one-page BOQ with typed columns, page numbers, title and currency', () => {
    const page = pdfPage(1, [
      text(60, 'Najd Gate Mixed-Use Tower', 14),
      text(82, 'Bill No. 3 - Concrete Works'),
      boqHeader(100),
      boqLine(118, ['3.01', 'Blinding concrete grade C15, 50 mm thick', 'm2', '6,400', '28.50', '182,400.00']),
      boqLine(131, ['3.02', 'Reinforced concrete grade C40 to rafts', 'm3', '4,250', '410.00', '1,742,500.00']),
      boqLine(144, ['3.03', 'Formwork to raft edges', 'm2', '1,180', '95.00', '112,100.00']),
      boqLine(157, ['', 'Total carried to Summary', '', '', '', '2,037,000.00']),
    ]);
    const table = only(extractPdfTables([page]));
    expect(table).toMatchObject({
      title: 'Najd Gate Mixed-Use Tower - Bill No. 3 - Concrete Works',
      sheet: null,
      pageFrom: 1,
      pageTo: 1,
      currency: 'SAR',
    });
    expect(columnsOf(table)).toEqual([
      { name: 'item_code', role: 'item_code', type: 'text' },
      { name: 'description', role: 'description', type: 'text' },
      { name: 'unit', role: 'unit', type: 'text' },
      { name: 'quantity', role: 'quantity', type: 'integer' },
      { name: 'rate', role: 'rate', type: 'number' },
      { name: 'amount', role: 'amount', type: 'integer' },
    ]);
    expect(table.columns.map((column) => column.label)).toEqual(['Item', 'Description', 'Unit', 'Qty', 'Rate (SAR)', 'Amount (SAR)']);
    expect(valuesOf(table)).toEqual([
      ['3.01', 'Blinding concrete grade C15, 50 mm thick', 'm2', 6400, 28.5, 182_400],
      ['3.02', 'Reinforced concrete grade C40 to rafts', 'm3', 4250, 410, 1_742_500],
      ['3.03', 'Formwork to raft edges', 'm2', 1180, 95, 112_100],
      [null, 'Total carried to Summary', null, null, null, 2_037_000],
    ]);
    expect(table.rows.map((row) => [row.page, row.sheetRow, row.isTotal])).toEqual([
      [1, null, false],
      [1, null, false],
      [1, null, false],
      [1, null, true],
    ]);
  });

  it('follows a table onto the next page past a repeated header, running headers and footers', () => {
    const pages = [
      pdfPage(1, [
        runningHeader(),
        text(70, 'Bill No. 4 - Facade Package', 12),
        boqHeader(100),
        boqLine(118, ['4.01', 'Granite cladding, 40 mm thick', 'm2', '6,850', '1,180.00', '8,083,000.00']),
        boqLine(131, ['4.02', 'GRC feature screens', 'm2', '3,240', '1,465.00', '4,746,600.00']),
        boqLine(144, ['', 'Carried forward', '', '', '', '12,829,600.00']),
        footer(1, 2),
      ]),
      pdfPage(2, [
        runningHeader(),
        boqHeader(70),
        boqLine(88, ['', 'Brought forward', '', '', '', '12,829,600.00']),
        boqLine(101, ['4.03', 'Shopfront glazing to retail units', 'm2', '2,180', '1,320.00', '2,877,600.00']),
        boqLine(114, ['', 'Total carried to Summary', '', '', '', '15,707,200.00']),
        text(150, 'Notes: the rates above include supply, delivery, installation, fixings, testing and protection of the works.'),
        footer(2, 2),
      ]),
    ];
    const table = only(extractPdfTables(pages));
    expect(table).toMatchObject({ title: 'Bill No. 4 - Facade Package', pageFrom: 1, pageTo: 2, currency: 'SAR' });
    expect(table.rows.map((row) => [row.page, row.values[0], row.values[1], row.values[5], row.isTotal])).toEqual([
      [1, '4.01', 'Granite cladding, 40 mm thick', 8_083_000, false],
      [1, '4.02', 'GRC feature screens', 4_746_600, false],
      [1, null, 'Carried forward', 12_829_600, true],
      [2, null, 'Brought forward', 12_829_600, true],
      [2, '4.03', 'Shopfront glazing to retail units', 2_877_600, false],
      [2, null, 'Total carried to Summary', 15_707_200, true],
    ]);
  });

  it('follows a table onto the next page when the header is not repeated', () => {
    const pages = [
      pdfPage(1, [
        boqHeader(100),
        boqLine(118, ['4.01', 'Granite cladding, 40 mm thick', 'm2', '6,850', '1,180.00', '8,083,000.00']),
        boqLine(131, ['4.02', 'GRC feature screens', 'm2', '3,240', '1,465.00', '4,746,600.00']),
      ]),
      pdfPage(2, [
        text(40, 'Najd Gate Mixed-Use Tower - Bill of Quantities - Phase 2 - Facade Package - Revision 0 - Issued 14 September 2026', 8),
        boqLine(60, ['4.03', 'Shopfront glazing to retail units', 'm2', '2,180', '1,320.00', '2,877,600.00']),
        boqLine(73, ['4.04', 'Aluminium soffit panels', 'm2', '1,140', '545.00', '621,300.00']),
        boqLine(86, ['', 'Total', '', '', '', '16,328,500.00']),
      ]),
    ];
    const table = only(extractPdfTables(pages));
    expect(table.pageTo).toBe(2);
    expect(table.rows.map((row) => [row.page, row.values[0], row.isTotal])).toEqual([
      [1, '4.01', false],
      [1, '4.02', false],
      [2, '4.03', false],
      [2, '4.04', false],
      [2, null, true],
    ]);
  });

  it('ends a table at the end of its page when the next page is prose', () => {
    const pages = [
      pdfPage(1, [
        boqHeader(100),
        boqLine(118, ['4.01', 'Granite cladding, 40 mm thick', 'm2', '6,850', '1,180.00', '8,083,000.00']),
      ]),
      pdfPage(2, [
        text(60, 'Clause 14. Payment'),
        text(80, 'The Employer shall pay the Contractor the amount certified in each Interim Payment Certificate'),
        text(92, 'within 30 days of receiving the statement, together with any supporting documents required.'),
        boqLine(120, ['', 'Retention', '', '', '', '5%']),
      ]),
    ];
    const table = only(extractPdfTables(pages));
    expect(table.pageTo).toBe(1);
    expect(table.rows).toHaveLength(1);
  });

  it('joins wrapped descriptions to the row above them', () => {
    const page = pdfPage(1, [
      boqHeader(100),
      boqLine(118, ['2.01', 'Excavation in rock for foundations,', 'm3', '1,200', '45.00', '54,000.00']),
      boqLine(131, ['', 'including disposal off site', '', '', '', '']),
      boqLine(144, ['2.02', 'Backfill with approved material', 'm3', '800', '22.50', '18,000.00']),
      boqLine(157, ['', 'compacted in layers', '', '', '', '']),
      boqLine(170, ['', 'not exceeding 200 mm', '', '', '', '']),
      boqLine(183, ['', 'Sub-total', '', '', '', '72,000.00']),
    ]);
    const table = only(extractPdfTables([page]));
    expect(descriptions(table)).toEqual([
      'Excavation in rock for foundations, including disposal off site',
      'Backfill with approved material compacted in layers not exceeding 200 mm',
      'Sub-total',
    ]);
    expect(table.rows.map((row) => row.isTotal)).toEqual([false, false, true]);
  });

  it('keeps description lines printed above bottom-aligned numbers with their own row', () => {
    const page = pdfPage(1, [
      boqHeader(100),
      boqLine(120, ['', 'Supply and install aluminium', '', '', '', '']),
      boqLine(131, ['5.01', 'louvres to plant rooms', 'm2', '640', '980.00', '627,200.00']),
      boqLine(149, ['5.02', 'Bird mesh to louvres', 'm2', '640', '38.00', '24,320.00']),
      boqLine(160, ['', 'fixed with stainless steel screws', '', '', '', '']),
    ]);
    const table = only(extractPdfTables([page]));
    expect(table.rows.map((row) => [row.values[0], row.values[1]])).toEqual([
      ['5.01', 'Supply and install aluminium louvres to plant rooms'],
      ['5.02', 'Bird mesh to louvres fixed with stainless steel screws'],
    ]);
  });

  it('turns capitals, titles and coded lines without numbers into sections', () => {
    const page = pdfPage(1, [
      boqHeader(100),
      boqLine(118, ['', 'SUBSTRUCTURE', '', '', '', '']),
      boqLine(131, ['1.1', 'Earthworks', '', '', '', '']),
      boqLine(144, ['1.1.01', 'Site clearance', 'm2', '8,400', '6.50', '54,600.00']),
      boqLine(157, ['', 'Concrete Works', '', '', '', '']),
      boqLine(170, ['1.2.01', 'Blinding concrete', 'm2', '6,400', '28.50', '182,400.00']),
      boqLine(183, ['', 'Grade C15 to the underside of rafts', '', '', '', '']),
      boqLine(196, ['', 'Sub-total Substructure', '', '', '', '237,000.00']),
    ]);
    const table = only(extractPdfTables([page]));
    expect(table.rows.map((row) => [row.values[0], row.values[1], row.section, row.isTotal])).toEqual([
      ['1.1.01', 'Site clearance', 'SUBSTRUCTURE - 1.1 Earthworks', false],
      ['1.2.01', 'Blinding concrete Grade C15 to the underside of rafts', 'Concrete Works', false],
      [null, 'Sub-total Substructure', 'Concrete Works', true],
    ]);
  });

  it('leaves a paragraph after the table out of it', () => {
    const page = pdfPage(1, [
      boqHeader(100),
      boqLine(118, ['3.01', 'Blinding concrete', 'm2', '6,400', '28.50', '182,400.00']),
      boqLine(131, ['', 'Total', '', '', '', '182,400.00']),
      text(160, 'All rates include supply, delivery, installation, testing and protection until handover.'),
      text(172, 'Quantities are measured net from the Drawings.'),
    ]);
    const table = only(extractPdfTables([page]));
    expect(descriptions(table)).toEqual(['Blinding concrete', 'Total']);
  });

  it('finds no table in prose that names the columns, or under a header with no rows', () => {
    const prose = pdfPage(1, [
      text(60, 'Clause 12 Measurement and Valuation'),
      text(80, 'Each item in the Bill gives a description, the unit, the quantity, the rate and the amount.'),
      text(92, 'The total of each page is carried forward to the next page and to the summary.'),
      line(130, [
        { text: 'Item', x: 40 },
        { text: 'Description', x: 90 },
        { text: 'Unit', x: 330 },
      ]),
      text(150, 'Rates are in Saudi Riyals unless stated otherwise.'),
    ]);
    expect(extractPdfTables([prose])).toEqual([]);
    expect(extractPdfTables([])).toEqual([]);
    expect(extractPdfTables([{ ...pdfPage(1, []), hasTextLayer: false }])).toEqual([]);
  });

  it('reads amounts written with currencies and scale words', () => {
    const page = pdfPage(1, [
      boqHeader(100, 'Rate', 'Amount'),
      boqLine(118, ['E.01', 'Chillers, 1,500 kW', 'nr', '2', 'SAR 600,000', 'SAR 1.2M']),
      boqLine(131, ['E.02', 'Generators', 'nr', '1', '1,250,000.00', 'SAR 1,250,000.00']),
    ]);
    const table = only(extractPdfTables([page]));
    expect(table.currency).toBe('SAR');
    expect(table.rows.map((row) => [row.values[4], row.values[5]])).toEqual([
      [600_000, 1_200_000],
      [1_250_000, 1_250_000],
    ]);
  });

  it('adds a currency column when the amounts mix currencies', () => {
    const page = pdfPage(1, [
      boqHeader(100, 'Rate', 'Amount'),
      boqLine(118, ['E.01', 'Chillers', 'nr', '2', 'USD 600,000', 'USD 1,200,000']),
      boqLine(131, ['C.01', 'Civil works', 'item', '1', 'SAR 3,500,000', 'SAR 3,500,000']),
    ]);
    const table = only(extractPdfTables([page]));
    expect(table.currency).toBeNull();
    expect(table.columns.at(-1)).toEqual({ name: 'currency', label: 'Currency', type: 'text', role: 'currency' });
    expect(table.rows.map((row) => [row.values[5], row.values[6]])).toEqual([
      [1_200_000, 'USD'],
      [3_500_000, 'SAR'],
    ]);
  });

  it('starts a new table at a header with other columns, titled by the line above it', () => {
    const page = pdfPage(1, [
      boqHeader(100),
      boqLine(118, ['3.01', 'Blinding concrete', 'm2', '6,400', '28.50', '182,400.00']),
      boqLine(131, ['3.02', 'Formwork to raft edges', 'm2', '1,180', '95.00', '112,100.00']),
      text(170, 'Schedule of Provisional Sums'),
      line(190, [
        { text: 'Ref', x: 40 },
        { text: 'Description', x: 90 },
        { text: 'Amount (SAR)', x: 550, right: true },
      ]),
      line(208, [
        { text: 'PS-01', x: 40 },
        { text: 'Public art installation', x: 90 },
        { text: '750,000.00', x: 550, right: true },
      ]),
      line(221, [
        { text: 'PS-02', x: 40 },
        { text: 'Utility diversions', x: 90 },
        { text: '1,200,000.00', x: 550, right: true },
      ]),
    ]);
    const [boq, sums] = extractPdfTables([page]);
    expect(boq?.title).toBeNull();
    expect(descriptions(boq as CleanTable)).toEqual(['Blinding concrete', 'Formwork to raft edges']);
    expect(sums?.title).toBe('Schedule of Provisional Sums');
    expect(columnsOf(sums as CleanTable).map((column) => column.name)).toEqual(['item_code', 'description', 'amount']);
    expect(valuesOf(sums as CleanTable)).toEqual([
      ['PS-01', 'Public art installation', 750_000],
      ['PS-02', 'Utility diversions', 1_200_000],
    ]);
  });

  it('places short descriptions under a centred header', () => {
    const centred = (label: string, middle: number) => ({ text: label, x: middle + (label.length * 4.5) / 2, right: true });
    const page = pdfPage(1, [
      line(100, [centred('Item', 60), centred('Description', 210), centred('Unit', 345), centred('Qty', 385), centred('Rate', 440), centred('Amount', 515)]),
      boqLine(118, ['1', 'Excavation in rock for foundations and pits', 'm3', '1,200', '45.00', '54,000.00']),
      boqLine(131, ['2', 'Concrete', 'm3', '300', '410.00', '123,000.00']),
    ]);
    const table = only(extractPdfTables([page]));
    expect(table.rows.map((row) => [row.values[0], row.values[1]])).toEqual([
      ['1', 'Excavation in rock for foundations and pits'],
      ['2', 'Concrete'],
    ]);
  });

  it('reads an Arabic table from right to left', () => {
    const arabicLine = (top: number, cells: readonly string[]) =>
      line(
        top,
        cells.map((cell, i) => ({ text: cell, x: [550, 480, 250, 190, 130, 70][i] ?? 0, right: true })),
      );
    const page = pdfPage(1, [
      line(80, [{ text: 'جدول الكميات - المرحلة الأولى', x: 550, right: true }]),
      arabicLine(100, ['البند', 'الوصف', 'الوحدة', 'الكمية', 'سعر الوحدة', 'المبلغ (ريال)']),
      arabicLine(118, ['١-١', 'أعمال الحفر', 'م٣', '٩٦٬٠٠٠', '٤٢', '٤٬٠٣٢٬٠٠٠']),
      arabicLine(131, ['١-٢', 'خرسانة النظافة', 'م٢', '٦٬٤٠٠', '٢٨٫٥', '١٨٢٬٤٠٠']),
      arabicLine(144, ['', 'الإجمالي', '', '', '', '٤٬٢١٤٬٤٠٠']),
    ]);
    const table = only(extractPdfTables([page]));
    expect(table.title).toBe('جدول الكميات - المرحلة الأولى');
    expect(table.currency).toBe('SAR');
    expect(table.columns.map((column) => column.name)).toEqual(['item_code', 'description', 'unit', 'quantity', 'rate', 'amount']);
    expect(valuesOf(table)).toEqual([
      ['١-١', 'أعمال الحفر', 'م٣', 96_000, 42, 4_032_000],
      ['١-٢', 'خرسانة النظافة', 'م٢', 6400, 28.5, 182_400],
      [null, 'الإجمالي', null, null, null, 4_214_400],
    ]);
    expect(table.rows.map((row) => row.isTotal)).toEqual([false, false, true]);
  });

  it('scans a 300-page specification quickly', () => {
    const sentence = 'The Contractor shall submit the unit rate, quantity and total amount for each item described in this section.';
    const pages = Array.from({ length: 300 }, (_, p) =>
      pdfPage(p + 1, Array.from({ length: 45 }, (_, i) => text(60 + i * 15, `${p + 1}.${i + 1} ${sentence}`))),
    );
    const started = performance.now();
    expect(extractPdfTables(pages)).toEqual([]);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
