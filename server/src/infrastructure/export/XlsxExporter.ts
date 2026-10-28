import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { ExportFormat } from '@atlas/shared';
import type { ExportableTable, ResultExporter } from '../../application/ports/ResultExporter';
import { toCsv, UTF8_BOM } from './csv';
import { buildWorkbook } from './workbook';

const MAX_COPIES = 1000;

/**
 * Writes a result as an Excel workbook or as a UTF-8 CSV file with a byte order mark.
 * Never overwrites: a second export with the same name gets -2, then -3, and so on.
 */
export class XlsxExporter implements ResultExporter {
  async export(table: ExportableTable, format: ExportFormat, directory: string, baseName: string): Promise<string> {
    if (baseName === '' || basename(baseName) !== baseName || baseName.startsWith('.')) {
      throw new Error(`Unsafe export file name: ${baseName}`);
    }
    const data = format === 'csv' ? UTF8_BOM + toCsv(table.columns, table.rows) : await buildWorkbook(table);
    await mkdir(directory, { recursive: true });
    return writeNewFile(directory, baseName, format, data);
  }
}

async function writeNewFile(directory: string, baseName: string, extension: string, data: string | Uint8Array): Promise<string> {
  for (let copy = 1; copy <= MAX_COPIES; copy++) {
    const path = join(directory, `${copy === 1 ? baseName : `${baseName}-${copy}`}.${extension}`);
    try {
      await writeFile(path, data, { flag: 'wx' });
      return path;
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
    }
  }
  throw new Error(`More than ${MAX_COPIES} exports are named ${baseName} in ${directory}.`);
}
