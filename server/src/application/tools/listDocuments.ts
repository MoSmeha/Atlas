import { z } from 'zod';
import type {
  ColumnType,
  DocumentSummary,
  DocumentType,
  FileKind,
  FileStatus,
  Language,
  TableSummary,
} from '@atlas/shared';
import { countStatuses, describeCounts, type StatusCounts } from '../../domain/documentStatus';
import { toPageRanges, type PageRange } from '../../domain/pageRanges';
import { defineTool } from './Tool';

export interface ListedTable {
  /** Table name to use in query_tables SQL. */
  sqlName: string;
  title: string | null;
  /** Excel tables only. */
  sheet: string | null;
  /** PDF tables only. */
  pages: PageRange | null;
  columns: { name: string; label: string; type: ColumnType }[];
  rowCount: number;
  currency: string | null;
}

export interface ListedDocument {
  name: string;
  path: string;
  kind: FileKind;
  status: FileStatus;
  statusDetail: string | null;
  classification: { type: DocumentType; confidence: number } | null;
  pageCount: number | null;
  sheets: string[];
  scannedPages: PageRange[];
  tables: ListedTable[];
  currencies: string[];
  language: Language | null;
}

export interface ListDocumentsOutput {
  counts: StatusCounts;
  documents: ListedDocument[];
}

const description = [
  'Lists every file in the loaded folder: its status, document type, page count or sheet names, scanned pages,',
  'language, currencies, and the SQL tables loaded from it with their columns, row counts and currency.',
  'Use it to see what the folder holds, to name files that are empty or could not be read (statusDetail says why),',
  'and to find table and column names for query_tables. Skipped files are not PDF or Excel.',
  'Scanned pages have no text layer; read them with look_at_page.',
].join(' ');

export const listDocuments = defineTool({
  name: 'list_documents',
  description,
  parameters: z.strictObject({}),
  async run(_args, context) {
    const documents = context.index
      .documents()
      .toSorted((a, b) => a.path.localeCompare(b.path))
      .map(toListedDocument);
    const counts = countStatuses(documents.map((doc) => doc.status));
    const output: ListDocumentsOutput = { counts, documents };
    return { output, summary: describeCounts(counts) };
  },
});

function toListedDocument(doc: DocumentSummary): ListedDocument {
  return {
    name: doc.name,
    path: doc.path,
    kind: doc.kind,
    status: doc.status,
    statusDetail: doc.statusDetail,
    classification: doc.classification
      ? { type: doc.classification.type, confidence: Math.round(doc.classification.confidence * 100) / 100 }
      : null,
    pageCount: doc.pageCount,
    sheets: doc.sheets,
    scannedPages: toPageRanges(doc.scannedPages),
    tables: doc.tables.map(toListedTable),
    currencies: doc.currencies,
    language: doc.language,
  };
}

function toListedTable(table: TableSummary): ListedTable {
  return {
    sqlName: table.name,
    title: table.title,
    sheet: table.sheet,
    pages: table.pageFrom === null ? null : { from: table.pageFrom, to: table.pageTo ?? table.pageFrom },
    columns: table.columns.map(({ name, label, type }) => ({ name, label, type })),
    rowCount: table.rowCount,
    currency: table.currency,
  };
}
