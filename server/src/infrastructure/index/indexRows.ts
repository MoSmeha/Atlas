import type { Classification, DocumentSummary, FileKind, FileStatus, Language, TableColumn } from '@atlas/shared';
import type { TableSchema } from '../../application/ports/DocumentIndex';
import { documentId } from '../../domain/documentId';

/** A row of the documents table as SQLite returns it; list fields are JSON text. */
export interface DocumentRow {
  path: string;
  name: string;
  kind: FileKind;
  status: FileStatus;
  status_detail: string | null;
  mtime_ms: number;
  size: number;
  page_count: number | null;
  scanned_pages: string;
  sheets: string;
  language: Language | null;
  currencies: string;
  classification: string | null;
}

/** A row of table_catalog; `columns` is JSON text. */
export interface CatalogRow {
  name: string;
  path: string;
  title: string | null;
  sheet: string | null;
  page_from: number | null;
  page_to: number | null;
  columns: string;
  row_count: number;
  currency: string | null;
}

export function toTableSchema(row: CatalogRow): TableSchema {
  return {
    name: row.name,
    document: row.path,
    title: row.title,
    sheet: row.sheet,
    pageFrom: row.page_from,
    pageTo: row.page_to,
    columns: parseJson<TableColumn[]>(row.columns, []),
    rowCount: row.row_count,
    currency: row.currency,
  };
}

/** The register entry for one document, with the tables it loaded. */
export function toSummary(row: DocumentRow, tables: TableSchema[]): DocumentSummary {
  return {
    id: documentId(row.path),
    name: row.name,
    path: row.path,
    kind: row.kind,
    status: row.status,
    statusDetail: row.status_detail,
    sizeBytes: row.size,
    pageCount: row.page_count,
    scannedPages: parseJson<number[]>(row.scanned_pages, []),
    sheets: parseJson<string[]>(row.sheets, []),
    tables: tables.map(({ document, ...table }) => table),
    currencies: parseJson<string[]>(row.currencies, []),
    language: row.language,
    classification: row.classification === null ? null : parseJson<Classification | null>(row.classification, null),
  };
}

function parseJson<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}
