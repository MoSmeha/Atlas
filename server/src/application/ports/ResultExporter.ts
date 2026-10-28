import type { ExportFormat, Source } from '@atlas/shared';
import type { CleanValue } from '../../domain/table';

export interface ExportableTable {
  title: string | null;
  columns: string[];
  rows: CleanValue[][];
  sources: Source[];
}

export interface ResultExporter {
  /** Writes the table into the directory and returns the absolute path of the new file. */
  export(table: ExportableTable, format: ExportFormat, directory: string, baseName: string): Promise<string>;
}
