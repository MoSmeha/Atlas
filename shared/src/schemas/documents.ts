import { z } from 'zod';

/** What happened when Atlas tried to read a file. One bad file never stops the others. */
export const FileStatus = z.enum(['ok', 'empty', 'corrupt', 'encrypted', 'scanned', 'too_large', 'skipped']);
export type FileStatus = z.infer<typeof FileStatus>;

export const FileKind = z.enum(['pdf', 'excel', 'other']);
export type FileKind = z.infer<typeof FileKind>;

export const DocumentType = z.enum([
  'Contract',
  'BOQ',
  'Specification',
  'Schedule',
  'Drawing',
  'Minutes',
  'Correspondence',
  'Other',
]);
export type DocumentType = z.infer<typeof DocumentType>;

export const Language = z.enum(['en', 'ar', 'mixed']);
export type Language = z.infer<typeof Language>;

export const Money = z.object({ amount: z.number(), currency: z.string() });
export type Money = z.infer<typeof Money>;

/** Fields the classifier extracts when it is confident. Missing values are null or empty. */
export const DocumentMetadata = z.object({
  projectName: z.string().nullable(),
  parties: z.array(z.string()),
  contractValue: Money.nullable(),
  keyDates: z.array(z.object({ label: z.string(), date: z.string() })),
});
export type DocumentMetadata = z.infer<typeof DocumentMetadata>;

export const Classification = z.object({
  type: DocumentType,
  confidence: z.number().min(0).max(1),
  metadata: DocumentMetadata,
});
export type Classification = z.infer<typeof Classification>;

export const ColumnType = z.enum(['text', 'number', 'integer']);
export type ColumnType = z.infer<typeof ColumnType>;

export const TableColumn = z.object({
  /** SQL column name. */
  name: z.string(),
  /** Header text as written in the document. */
  label: z.string(),
  type: ColumnType,
});
export type TableColumn = z.infer<typeof TableColumn>;

/** A table Atlas found in a document and loaded into SQL. */
export const TableSummary = z.object({
  name: z.string(),
  title: z.string().nullable(),
  sheet: z.string().nullable(),
  pageFrom: z.number().int().nullable(),
  pageTo: z.number().int().nullable(),
  columns: z.array(TableColumn),
  rowCount: z.number().int(),
  currency: z.string().nullable(),
});
export type TableSummary = z.infer<typeof TableSummary>;

export const DocumentSummary = z.object({
  /** Stable id derived from the relative path; used in URLs. */
  id: z.string(),
  name: z.string(),
  /** Path relative to the loaded folder, with forward slashes. */
  path: z.string(),
  kind: FileKind,
  status: FileStatus,
  statusDetail: z.string().nullable(),
  sizeBytes: z.number().int(),
  pageCount: z.number().int().nullable(),
  scannedPages: z.array(z.number().int()),
  sheets: z.array(z.string()),
  tables: z.array(TableSummary),
  currencies: z.array(z.string()),
  language: Language.nullable(),
  classification: Classification.nullable(),
});
export type DocumentSummary = z.infer<typeof DocumentSummary>;
