import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { ExportableTable } from '../../src/application/ports/ResultExporter';
import { XlsxExporter } from '../../src/infrastructure/export/XlsxExporter';

const boq: ExportableTable = {
  title: 'BOQ items above 1M',
  columns: ['item_code', 'description', 'quantity', 'rate', 'amount', '_row'],
  rows: [
    ['A1', 'Bored piles, 600 mm diameter, including reinforcement and testing to specification clause 4.2', 10, 200000, 2000000, 5],
    ['B7', 'أعمال الخرسانة المسلحة للأساسات', 12.5, 96000.75, 1200009.38, 9],
    ['C3', null, null, null, 1500000, 12],
  ],
  sources: [
    { kind: 'excel', document: 'BOQ_Phase2.xlsx', sheet: 'Bill 1', rowFrom: 5, rowTo: 12 },
    { kind: 'pdf', document: 'Contract.pdf', page: 14, quote: 'Bill 1 is measured in SAR' },
  ],
};

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'atlas-export-'));
}

async function readWorkbook(path: string): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  return workbook;
}

describe('XlsxExporter, xlsx', () => {
  it('writes the rows to a Result sheet with a bold, frozen header and numbers as numbers', async () => {
    const path = await new XlsxExporter().export(boq, 'xlsx', tempDir(), 'boq-items');
    expect(basename(path)).toBe('boq-items.xlsx');

    const workbook = await readWorkbook(path);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Result', 'Sources']);
    const sheet = workbook.getWorksheet('Result') as ExcelJS.Worksheet;
    expect(sheet.getRow(1).values).toEqual([undefined, ...boq.columns]);
    expect(sheet.getCell('A1').font?.bold).toBe(true);
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(sheet.rowCount).toBe(4);

    expect(sheet.getCell('E2').value).toBe(2000000);
    expect(sheet.getCell('E2').numFmt).toBe('#,##0.00##');
    expect(sheet.getCell('C3').value).toBe(12.5);
    expect(sheet.getCell('F2').value).toBe(5);
    expect(sheet.getCell('F2').numFmt).toBeUndefined();
    expect(sheet.getCell('B3').value).toBe('أعمال الخرسانة المسلحة للأساسات');
    expect(sheet.getCell('B4').value).toBeNull();
  });

  it('sizes columns to their content within limits', async () => {
    const sheet = (await readWorkbook(await new XlsxExporter().export(boq, 'xlsx', tempDir(), 'widths'))).getWorksheet(
      'Result',
    ) as ExcelJS.Worksheet;
    const width = (column: string) => sheet.getColumn(column).width ?? 0;
    expect(width('A')).toBeGreaterThanOrEqual(8);
    expect(width('A')).toBeLessThan(width('B'));
    expect(width('B')).toBe(60);
    expect(sheet.getCell('B2').alignment?.wrapText).toBe(true);
    expect(width('E')).toBeGreaterThanOrEqual('1,200,009.38'.length);
  });

  it('lists every source on a Sources sheet', async () => {
    const workbook = await readWorkbook(await new XlsxExporter().export(boq, 'xlsx', tempDir(), 'sources'));
    const sheet = workbook.getWorksheet('Sources') as ExcelJS.Worksheet;
    expect(sheet.getRow(1).values).toEqual([undefined, 'File', 'Page', 'Sheet', 'Rows', 'Quote']);
    expect(sheet.getRow(2).values).toEqual([undefined, 'BOQ_Phase2.xlsx', undefined, 'Bill 1', '5-12']);
    expect(sheet.getRow(3).values).toEqual([undefined, 'Contract.pdf', 14, undefined, undefined, 'Bill 1 is measured in SAR']);
  });

  it('says so when a result has no sources', async () => {
    const path = await new XlsxExporter().export({ ...boq, sources: [] }, 'xlsx', tempDir(), 'no-sources');
    const sheet = (await readWorkbook(path)).getWorksheet('Sources') as ExcelJS.Worksheet;
    expect(sheet.getCell('A2').value).toBe('No sources were recorded for this result.');
  });

  it('creates the directory and never overwrites an earlier export', async () => {
    const directory = join(tempDir(), 'nested', 'exports');
    const exporter = new XlsxExporter();
    const first = await exporter.export(boq, 'xlsx', directory, 'boq');
    const second = await exporter.export({ ...boq, rows: [] }, 'xlsx', directory, 'boq');
    const third = await exporter.export(boq, 'xlsx', directory, 'boq');
    expect([first, second, third].map((path) => basename(path))).toEqual(['boq.xlsx', 'boq-2.xlsx', 'boq-3.xlsx']);
    expect((await readWorkbook(first)).getWorksheet('Result')?.rowCount).toBe(4);
    expect((await readWorkbook(second)).getWorksheet('Result')?.rowCount).toBe(1);
  });

  it('refuses a base name that would leave the directory', async () => {
    await expect(new XlsxExporter().export(boq, 'xlsx', tempDir(), '../escape')).rejects.toThrow(/Unsafe/);
  });
});

describe('XlsxExporter, csv', () => {
  it('writes UTF-8 with a byte order mark and RFC 4180 quoting', async () => {
    const table: ExportableTable = {
      title: null,
      columns: ['item_code', 'description', 'amount'],
      rows: [
        ['A1', 'Piles, bored', 2000000],
        ['A2', 'Pipe 12" "heavy"', 0.5],
        ['A3', 'line one\nline two', null],
        ['B1', 'أعمال الخرسانة', 1500000],
      ],
      sources: [],
    };
    const path = await new XlsxExporter().export(table, 'csv', tempDir(), 'boq');
    expect(basename(path)).toBe('boq.csv');

    const bytes = readFileSync(path);
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(bytes.subarray(3).toString('utf8')).toBe(
      'item_code,description,amount\r\n' +
        'A1,"Piles, bored",2000000\r\n' +
        'A2,"Pipe 12"" ""heavy""",0.5\r\n' +
        'A3,"line one\nline two",\r\n' +
        'B1,أعمال الخرسانة,1500000\r\n',
    );
  });

  it('also never overwrites a CSV file', async () => {
    const directory = tempDir();
    const exporter = new XlsxExporter();
    await exporter.export(boq, 'csv', directory, 'boq');
    expect(basename(await exporter.export(boq, 'csv', directory, 'boq'))).toBe('boq-2.csv');
  });
});
