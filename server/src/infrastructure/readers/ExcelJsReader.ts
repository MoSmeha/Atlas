import { readFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import type { DocumentReader, ReadOutcome } from '../../application/ports/DocumentReader';
import { officeContainerOutcome } from './officeContainer';
import { describeReadError } from './readError';
import { MAX_SHEET_CELLS, sheetGrid, type SheetGridResult } from './sheetGrid';

const NOT_A_WORKBOOK = 'The file is not a valid Excel workbook.';
/** Sheet parts Atlas never uses. Data validations over whole columns are slow to load, so they are skipped. */
const IGNORED_NODES = ['dataValidations', 'conditionalFormatting', 'extLst'];

export interface ExcelJsReaderOptions {
  /** Cells one sheet may hold; rows past the limit are left out and the outcome's detail says so. */
  maxSheetCells: number;
}

/**
 * The DocumentReader for .xlsx and .xlsm workbooks, with exceljs. Every worksheet becomes a SheetGrid, empty ones included.
 * Never throws for a bad file: a damaged or non-Excel file is 'corrupt', a password-protected one 'encrypted',
 * and a 0-byte file or one whose sheets are all empty is 'empty'.
 */
export class ExcelJsReader implements DocumentReader {
  readonly extensions: readonly string[] = ['.xlsx', '.xlsm'];
  private readonly maxSheetCells: number;

  constructor(options: ExcelJsReaderOptions = { maxSheetCells: MAX_SHEET_CELLS }) {
    this.maxSheetCells = options.maxSheetCells;
  }

  async read(filePath: string): Promise<ReadOutcome> {
    let bytes: Buffer;
    try {
      bytes = await readFile(filePath);
    } catch (error) {
      return { status: 'corrupt', detail: describeReadError(error) };
    }
    if (bytes.length === 0) return { status: 'empty', detail: 'The file is empty (0 bytes).' };
    const container = officeContainerOutcome(bytes);
    if (container) return container;

    const sheets = await this.readSheets(bytes);
    if (sheets === null || sheets.length === 0) return { status: 'corrupt', detail: NOT_A_WORKBOOK };
    if (sheets.every(({ grid }) => grid.rows.length === 0)) {
      return { status: 'empty', detail: 'The workbook opens, but every sheet is empty.' };
    }
    return { status: 'ok', document: { kind: 'excel', sheets: sheets.map(({ grid }) => grid) }, detail: truncationNote(sheets) };
  }

  /** Null when exceljs cannot open the bytes: not a zip, a zip cut short, or a zip without a workbook inside. */
  private async readSheets(bytes: Buffer): Promise<SheetGridResult[] | null> {
    try {
      const workbook = new ExcelJS.Workbook();
      // exceljs types its input as an ArrayBuffer, but hands it straight to JSZip, which reads a Node Buffer as is.
      await workbook.xlsx.load(bytes as unknown as ArrayBuffer, { ignoreNodes: IGNORED_NODES });
      return workbook.worksheets.map((worksheet) => sheetGrid(worksheet, this.maxSheetCells));
    } catch {
      return null;
    }
  }
}

/** For example 'Sheet "Ledger" is too large to read in full; only rows 1 to 200,000 were read.' Null when every sheet was read. */
function truncationNote(sheets: SheetGridResult[]): string | null {
  const notes = sheets
    .filter(({ truncatedAtRow }) => truncatedAtRow !== null)
    .map(({ grid, truncatedAtRow }) => {
      const lastRow = (truncatedAtRow ?? 0).toLocaleString('en-US');
      return `Sheet "${grid.name}" is too large to read in full; only rows 1 to ${lastRow} were read.`;
    });
  return notes.length > 0 ? notes.join(' ') : null;
}
