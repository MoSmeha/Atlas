import type { Classification, DocumentSummary, FileKind, FileStatus, Language, TableSummary } from '@atlas/shared';
import type { CleanTable, CleanValue } from '../../domain/table';

export interface Fingerprint {
  mtimeMs: number;
  size: number;
}

export interface SheetRow {
  /** Row number as Excel shows it. */
  rowNumber: number;
  cells: CleanValue[];
}

/** Everything the indexing pass learned about one file. Unreadable files are saved too, with their status. */
export interface DocumentRecord {
  /** Relative to the folder, forward slashes. */
  path: string;
  name: string;
  kind: FileKind;
  status: FileStatus;
  statusDetail: string | null;
  fingerprint: Fingerprint;
  pageCount: number | null;
  scannedPages: number[];
  sheets: string[];
  language: Language | null;
  currencies: string[];
  /** PDF page text, used by read_pages. */
  pages: { number: number; text: string }[];
  /** Page text split for search; only these are embedded. */
  chunks: { page: number; text: string }[];
  /** Become real SQL tables. */
  tables: CleanTable[];
  /** Raw sheet rows for the viewer. */
  sheetRows: { sheet: string; rows: SheetRow[] }[];
}

export interface SearchHit {
  chunkId: number;
  document: string;
  page: number;
  text: string;
  score: number;
}

/** A loaded SQL table and the document it came from. */
export interface TableSchema extends TableSummary {
  document: string;
}

export interface TableRowRecord {
  /** Keyed by SQL column name. */
  values: Record<string, CleanValue>;
  sheetRow: number | null;
  page: number | null;
  isTotal: boolean;
  section: string | null;
}

export interface QueryResult {
  columns: string[];
  rows: CleanValue[][];
  /** True when the row cap cut the result. */
  truncated: boolean;
}

/** The searchable store for one folder: documents, page text, chunks with embeddings, and SQL tables. */
export interface DocumentIndex {
  /** Size and modified time recorded for a path, used to skip unchanged files. */
  fingerprint(path: string): Fingerprint | null;
  /** Stores a document, replacing any earlier version of the same path. */
  save(record: DocumentRecord): void;
  remove(path: string): void;
  documents(): DocumentSummary[];
  /** Matches a file name or relative path, ignoring case. */
  find(nameOrPath: string): DocumentSummary | null;
  setClassification(path: string, classification: Classification | null): void;

  /** How many chunks still have no embedding. */
  pendingEmbeddingCount(): number;
  pendingEmbeddings(limit: number): { chunkId: number; text: string }[];
  saveEmbeddings(items: { chunkId: number; vector: Float32Array }[]): void;
  keywordSearch(query: string, options: { document: string | null; limit: number }): SearchHit[];
  vectorSearch(vector: Float32Array, options: { document: string | null; limit: number }): SearchHit[];

  readPages(path: string, from: number, to: number): { number: number; text: string }[];
  tables(): TableSchema[];
  tableRows(table: string): TableRowRecord[];
  /** Runs one read-only SELECT on a separate read-only connection, with a row cap and a timeout. */
  query(sql: string, options: { maxRows: number; timeoutMs: number }): Promise<QueryResult>;
  sheetRows(path: string, sheet: string, from: number, to: number): { totalRows: number; columnCount: number; rows: SheetRow[] };
  close(): void;
}

export interface DocumentIndexFactory {
  /** Opens, or creates, the index file for a folder. */
  open(folder: string): DocumentIndex;
}
