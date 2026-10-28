import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ReadOutcome } from '../../src/application/ports/DocumentReader';
import type { SheetGrid } from '../../src/domain/document';
import { ExcelJsReader } from '../../src/infrastructure/readers/ExcelJsReader';

let dir: string;
const reader = new ExcelJsReader();

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'atlas-excel-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Writes a workbook built by `build` to the temp folder and returns its path. */
async function workbookFile(name: string, build: (workbook: ExcelJS.Workbook) => void): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  build(workbook);
  const path = join(dir, name);
  await workbook.xlsx.writeFile(path);
  return path;
}

function bytesFile(name: string, bytes: Uint8Array | string): string {
  const path = join(dir, name);
  writeFileSync(path, bytes);
  return path;
}

function sheetsOf(outcome: ReadOutcome): SheetGrid[] {
  if (outcome.status !== 'ok') throw new Error(`Expected ok, got ${outcome.status}: ${outcome.detail}`);
  if (outcome.document.kind !== 'excel') throw new Error('Expected a workbook');
  return outcome.document.sheets;
}

describe('ExcelJsReader, cell values', () => {
  it('reads every kind of value into a dense grid, formulas as their cached results', async () => {
    const path = await workbookFile('Values.xlsx', (workbook) => {
      const sheet = workbook.addWorksheet('Values');
      sheet.addRow(['Item', 'Qty', 'Rate', 'Amount', 'Done', 'Date', 'الوصف']);
      sheet.getCell('A2').value = '  A-101  ';
      sheet.getCell('B2').value = 12.5;
      sheet.getCell('C2').value = 400;
      sheet.getCell('D2').value = { formula: 'B2*C2', result: 5000 };
      sheet.getCell('E2').value = true;
      sheet.getCell('F2').value = new Date(Date.UTC(2024, 0, 15));
      sheet.getCell('G2').value = { richText: [{ text: 'Excavation ', font: { bold: true } }, { text: 'in rock' }] };
      sheet.getCell('A3').value = { text: 'A-102', hyperlink: 'https://example.com/items/A-102' };
      sheet.getCell('B3').value = 0;
      sheet.getCell('C3').value = { error: '#DIV/0!' };
      sheet.getCell('D3').value = { formula: 'B3/C3', result: { error: '#VALUE!' } };
      sheet.getCell('E3').value = { formula: 'B3>0', result: false };
      sheet.getCell('F3').value = '   ';
      sheet.getCell('G3').value = { formula: 'B3*2', result: 0 };
      sheet.getCell('A5').value = { formula: '"Total"', result: 'Total' };
      sheet.getCell('B5').value = { formula: 'SUM(B2:B3)' };
      sheet.getCell('D5').value = { formula: 'SUM(D2:D3)', result: 5000 };
      // Formatting without a value does not make a cell used.
      sheet.getCell('K20').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    });

    const outcome = await reader.read(path);
    expect(outcome).toMatchObject({ status: 'ok', detail: null });
    const [sheet] = sheetsOf(outcome);
    expect(sheet?.name).toBe('Values');
    expect(sheet?.merges).toEqual([]);
    expect(sheet?.rows).toEqual([
      ['Item', 'Qty', 'Rate', 'Amount', 'Done', 'Date', 'الوصف'],
      ['A-101', 12.5, 400, 5000, true, new Date(Date.UTC(2024, 0, 15)), 'Excavation in rock'],
      ['A-102', 0, null, null, false, null, 0],
      [null, null, null, null, null, null, null],
      ['Total', null, null, 5000, null, null, null],
    ]);
  });

  it('reads shared formulas by their cached results, never the formula text', async () => {
    const path = await workbookFile('Shared.xlsx', (workbook) => {
      const sheet = workbook.addWorksheet('Rates');
      sheet.addRows([[1], [2], [3]]);
      sheet.fillFormula('B1:B3', 'A1*10', [10, 20, 30]);
    });
    const [sheet] = sheetsOf(await reader.read(path));
    expect(sheet?.rows).toEqual([
      [1, 10],
      [2, 20],
      [3, 30],
    ]);
  });
});

describe('ExcelJsReader, merges and sheets', () => {
  it('keeps merged header ranges and the value only in their top-left cell', async () => {
    const path = await workbookFile('Bill 1.xlsx', (workbook) => {
      const sheet = workbook.addWorksheet('Bill 1');
      sheet.getCell('A1').value = 'Bill 1 - Earthworks';
      sheet.mergeCells('A1:E1');
      sheet.getCell('A2').value = 'Item';
      sheet.getCell('B2').value = 'Description';
      sheet.mergeCells('B2:B3');
      sheet.getCell('C2').value = 'Rates';
      sheet.mergeCells('C2:D2');
      sheet.getCell('C3').value = 'Labour';
      sheet.getCell('D3').value = 'Material';
      sheet.addRow(['E-1', 'Excavation', 10, 20]);
      // A merge with nothing in it says nothing about the table and is left out.
      sheet.mergeCells('F6:G7');
    });

    const [sheet] = sheetsOf(await reader.read(path));
    expect(sheet?.merges).toEqual([
      { top: 1, left: 1, bottom: 1, right: 5 },
      { top: 2, left: 2, bottom: 3, right: 2 },
      { top: 2, left: 3, bottom: 2, right: 4 },
    ]);
    expect(sheet?.rows).toEqual([
      ['Bill 1 - Earthworks', null, null, null, null],
      ['Item', 'Description', 'Rates', null, null],
      [null, null, 'Labour', 'Material', null],
      ['E-1', 'Excavation', 10, 20, null],
    ]);
  });

  it('returns every sheet in workbook order, empty ones included', async () => {
    const path = await workbookFile('Two sheets.xlsx', (workbook) => {
      workbook.addWorksheet('Summary').addRow(['Total', 100]);
      workbook.addWorksheet('Notes');
      workbook.addWorksheet('جدول الكميات').addRow(['B-1', 'Concrete', 'م3', 12]);
    });

    const sheets = sheetsOf(await reader.read(path));
    expect(sheets.map((sheet) => sheet.name)).toEqual(['Summary', 'Notes', 'جدول الكميات']);
    expect(sheets[0]?.rows).toEqual([['Total', 100]]);
    expect(sheets[1]).toEqual({ name: 'Notes', rows: [], merges: [] });
    expect(sheets[2]?.rows).toEqual([['B-1', 'Concrete', 'م3', 12]]);
  });

  it('reads a 10,000-row ledger in full', async () => {
    const path = await workbookFile('Ledger.xlsx', (workbook) => {
      const sheet = workbook.addWorksheet('Ledger');
      sheet.addRow(['Ref', 'Description', 'Debit', 'Currency']);
      for (let i = 1; i <= 10_000; i++) sheet.addRow([`R-${i}`, `Payment ${i}`, i * 1.5, i % 2 ? 'SAR' : 'USD']);
    });
    const [sheet] = sheetsOf(await reader.read(path));
    expect(sheet?.rows).toHaveLength(10_001);
    expect(sheet?.rows[10_000]).toEqual(['R-10000', 'Payment 10000', 15_000, 'USD']);
  });
});

describe('ExcelJsReader, files it cannot use', () => {
  it('handles .xlsx and .xlsm files', () => {
    expect(reader.extensions).toEqual(['.xlsx', '.xlsm']);
  });

  it('reports a workbook whose sheets are all empty', async () => {
    const path = await workbookFile('Blank.xlsx', (workbook) => {
      workbook.addWorksheet('Sheet1');
      const sheet = workbook.addWorksheet('Sheet2');
      sheet.getCell('B2').value = '   ';
      sheet.getCell('C3').font = { bold: true };
      sheet.mergeCells('D4:E5');
    });
    expect(await reader.read(path)).toEqual({ status: 'empty', detail: 'Every sheet in the workbook is empty.' });
  });

  it('reports a 0-byte file as empty', async () => {
    expect(await reader.read(bytesFile('Empty.xlsx', ''))).toEqual({ status: 'empty', detail: 'The file is empty (0 bytes).' });
  });

  it('reports garbage bytes as not a valid workbook', async () => {
    const path = bytesFile('Garbage.xlsx', 'This is not a spreadsheet, just some text with an .xlsx name.');
    expect(await reader.read(path)).toEqual({ status: 'corrupt', detail: 'The file is not a valid Excel workbook.' });
  });

  it('reports a workbook cut short as not a valid workbook', async () => {
    const path = await workbookFile('Whole.xlsx', (workbook) => workbook.addWorksheet('Bill').addRow(['A-1', 100]));
    const bytes = readFileSync(path);
    const cut = bytesFile('Cut.xlsx', bytes.subarray(0, Math.floor(bytes.length / 2)));
    expect(await reader.read(cut)).toEqual({ status: 'corrupt', detail: 'The file is not a valid Excel workbook.' });
  });

  it('reports a zip file with no workbook inside as not a valid workbook', async () => {
    const path = await workbookFile('Whole.xlsx', (workbook) => workbook.addWorksheet('Bill').addRow(['A-1', 100]));
    // Renaming the workbook part keeps a valid zip that Excel and exceljs no longer recognise.
    const renamed = readFileSync(path).toString('latin1').replaceAll('xl/workbook.xml', 'xl/workbook.xmz');
    const zip = bytesFile('Archive.xlsx', Buffer.from(renamed, 'latin1'));
    expect(await reader.read(zip)).toEqual({ status: 'corrupt', detail: 'The file is not a valid Excel workbook.' });
  });

  it('tells a password-protected workbook from an old .xls file under an .xlsx name', async () => {
    const ole = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    const padding = Buffer.alloc(504);
    const encrypted = bytesFile('Locked.xlsx', Buffer.concat([ole, padding, Buffer.from('EncryptedPackage', 'utf16le'), padding]));
    const legacy = bytesFile('Old.xlsx', Buffer.concat([ole, padding, Buffer.from('Workbook', 'utf16le'), padding]));

    expect(await reader.read(encrypted)).toEqual({ status: 'encrypted', detail: 'The workbook is password-protected.' });
    expect(await reader.read(legacy)).toMatchObject({ status: 'corrupt', detail: expect.stringMatching(/97-2003.*save it as \.xlsx/) });
  });

  it('reports a file that disappeared before it was read', async () => {
    expect(await reader.read(join(dir, 'Missing.xlsx'))).toEqual({
      status: 'corrupt',
      detail: 'The file was removed before it could be read.',
    });
  });

  it('reads a very large sheet only up to the cell limit and says so', async () => {
    const path = await workbookFile('Stray.xlsx', (workbook) => {
      const sheet = workbook.addWorksheet('Ledger');
      sheet.addRows([
        ['Ref', 'Amount', 'Currency'],
        ['R-1', 10, 'SAR'],
      ]);
      // One stray value far down the sheet would otherwise make a 3 x 100,000 grid.
      sheet.getCell('A100000').value = 'stray';
      workbook.addWorksheet('Summary').addRow(['Total', 10]);
    });

    const outcome = await new ExcelJsReader({ maxSheetCells: 30 }).read(path);
    expect(outcome.detail).toBe('Sheet "Ledger" is too large to read in full; only rows 1 to 10 were read.');
    const [ledger, summary] = sheetsOf(outcome);
    expect(ledger?.rows).toHaveLength(10);
    expect(ledger?.rows.slice(0, 3)).toEqual([
      ['Ref', 'Amount', 'Currency'],
      ['R-1', 10, 'SAR'],
      [null, null, null],
    ]);
    expect(summary?.rows).toEqual([['Total', 10]]);
  });
});
