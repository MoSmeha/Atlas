import type { Classification, DocumentSummary, TableColumn } from '@atlas/shared';
import Database from 'better-sqlite3';
import type {
  DocumentIndex,
  DocumentRecord,
  Fingerprint,
  QueryResult,
  SearchHit,
  SheetRow,
  TableRowRecord,
  TableSchema,
} from '../../application/ports/DocumentIndex';
import { META_COLUMNS, type CleanValue } from '../../domain/table';
import { foldText } from './foldText';
import { ftsQuery } from './ftsQuery';
import { toSummary, toTableSchema, type CatalogRow, type DocumentRow } from './indexRows';
import { QueryRunner } from './QueryRunner';
import { quoteIdentifier } from './quoteIdentifier';
import { applySchema, FOLD_FUNCTION } from './schema';
import { dropTables, writeTables } from './tableWriter';
import { bufferToVector, cosine, magnitude, vectorToBuffer } from './vectors';

interface CachedVector {
  chunkId: number;
  path: string;
  page: number;
  vector: Float32Array;
  magnitude: number;
}

/**
 * The DocumentIndex for one folder in one SQLite file: documents, page text, chunks with FTS5 and embeddings,
 * and one SQL table per clean table. Writes go through this connection; `query` uses a separate read-only one.
 */
export class SqliteIndex implements DocumentIndex {
  readonly file: string;
  private readonly db: Database.Database;
  private readonly runner: QueryRunner;
  /** Every stored embedding, loaded on the first vector search and dropped whenever chunks or embeddings change. */
  private vectors: CachedVector[] | null = null;

  constructor(file: string) {
    this.file = file;
    this.db = new Database(file);
    try {
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.function(FOLD_FUNCTION, { deterministic: true }, (text) => foldText(typeof text === 'string' ? text : ''));
      applySchema(this.db);
      this.db.pragma('foreign_keys = ON');
    } catch (error) {
      this.db.close();
      throw error;
    }
    this.runner = new QueryRunner(file);
  }

  fingerprint(path: string): Fingerprint | null {
    const row = this.db.prepare('SELECT mtime_ms AS mtimeMs, size FROM documents WHERE path = ?').get(path);
    return (row as Fingerprint | undefined) ?? null;
  }

  save(record: DocumentRecord): void {
    this.db.transaction(() => {
      this.deleteDocument(record.path);
      this.db
        .prepare(
          `INSERT INTO documents (path, name, kind, status, status_detail, mtime_ms, size, page_count, scanned_pages, sheets, language, currencies)
           VALUES (@path, @name, @kind, @status, @statusDetail, @mtimeMs, @size, @pageCount, @scannedPages, @sheets, @language, @currencies)`,
        )
        .run({
          path: record.path,
          name: record.name,
          kind: record.kind,
          status: record.status,
          statusDetail: record.statusDetail,
          mtimeMs: record.fingerprint.mtimeMs,
          size: record.fingerprint.size,
          pageCount: record.pageCount,
          scannedPages: JSON.stringify(record.scannedPages),
          sheets: JSON.stringify(record.sheets),
          language: record.language,
          currencies: JSON.stringify(record.currencies),
        });
      const page = this.db.prepare('INSERT OR REPLACE INTO pages (path, number, text) VALUES (?, ?, ?)');
      for (const { number, text } of record.pages) page.run(record.path, number, text);
      const chunk = this.db.prepare('INSERT INTO chunks (path, page, text) VALUES (?, ?, ?)');
      for (const { page: number, text } of record.chunks) if (text.trim() !== '') chunk.run(record.path, number, text);
      writeTables(this.db, record.path, record.name, record.tables);
      const sheetRow = this.db.prepare('INSERT OR REPLACE INTO sheet_rows (path, sheet, row_number, cells) VALUES (?, ?, ?, ?)');
      for (const { sheet, rows } of record.sheetRows) {
        for (const row of rows) sheetRow.run(record.path, sheet, row.rowNumber, JSON.stringify(row.cells));
      }
    })();
    this.vectors = null;
  }

  remove(path: string): void {
    this.db.transaction(() => this.deleteDocument(path))();
    this.vectors = null;
  }

  documents(): DocumentSummary[] {
    const tables = this.tables();
    return this.documentRows().map((row) => toSummary(row, tables.filter((table) => table.document === row.path)));
  }

  find(nameOrPath: string): DocumentSummary | null {
    const wanted = nameOrPath.trim().replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
    const rows = this.documentRows();
    const row = rows.find((r) => r.path.toLowerCase() === wanted) ?? rows.find((r) => r.name.toLowerCase() === wanted);
    return row ? toSummary(row, this.tablesOf(row.path)) : null;
  }

  setClassification(path: string, classification: Classification | null): void {
    const value = classification === null ? null : JSON.stringify(classification);
    this.db.prepare('UPDATE documents SET classification = ? WHERE path = ?').run(value, path);
  }

  excluded(): string[] {
    return this.db.prepare('SELECT path FROM excluded ORDER BY path COLLATE NOCASE').pluck().all() as string[];
  }

  exclude(path: string): void {
    this.db.prepare('INSERT OR IGNORE INTO excluded (path) VALUES (?)').run(path);
  }

  include(path: string): void {
    this.db.prepare('DELETE FROM excluded WHERE path = ?').run(path);
  }

  pendingEmbeddingCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM chunks WHERE embedding IS NULL').get() as { count: number };
    return row.count;
  }

  pendingEmbeddings(limit: number): { chunkId: number; text: string }[] {
    const rows = this.db.prepare('SELECT id AS chunkId, text FROM chunks WHERE embedding IS NULL ORDER BY id LIMIT ?').all(limit);
    return rows as { chunkId: number; text: string }[];
  }

  saveEmbeddings(items: { chunkId: number; vector: Float32Array }[]): void {
    const update = this.db.prepare('UPDATE chunks SET embedding = ? WHERE id = ?');
    this.db.transaction(() => {
      for (const item of items) update.run(vectorToBuffer(item.vector), item.chunkId);
    })();
    this.vectors = null;
  }

  keywordSearch(query: string, options: { document: string | null; limit: number }): SearchHit[] {
    const match = ftsQuery(query);
    if (match === null || options.limit <= 0) return [];
    const path = this.scope(options.document);
    const rows = this.db
      .prepare(
        `SELECT c.id AS chunkId, c.path AS document, c.page, c.text, bm25(chunks_fts) AS rank
         FROM chunks_fts JOIN chunks c ON c.id = chunks_fts.rowid
         WHERE chunks_fts MATCH @match ${path === null ? '' : 'AND c.path = @path'}
         ORDER BY rank LIMIT @limit`,
      )
      .all(path === null ? { match, limit: options.limit } : { match, path, limit: options.limit });
    return (rows as (Omit<SearchHit, 'score'> & { rank: number })[]).map(({ rank, ...hit }) => ({ ...hit, score: -rank }));
  }

  vectorSearch(vector: Float32Array, options: { document: string | null; limit: number }): SearchHit[] {
    if (options.limit <= 0) return [];
    const path = this.scope(options.document);
    const length = magnitude(vector);
    const best = this.cachedVectors()
      .filter((entry) => entry.vector.length === vector.length && (path === null || entry.path === path))
      .map((entry) => ({ entry, score: cosine(vector, entry.vector, length, entry.magnitude) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit);
    const text = this.db.prepare('SELECT text FROM chunks WHERE id = ?').pluck();
    return best.map(({ entry, score }) => ({
      chunkId: entry.chunkId,
      document: entry.path,
      page: entry.page,
      text: text.get(entry.chunkId) as string,
      score,
    }));
  }

  readPages(path: string, from: number, to: number): { number: number; text: string }[] {
    const rows = this.db.prepare('SELECT number, text FROM pages WHERE path = ? AND number BETWEEN ? AND ? ORDER BY number').all(path, from, to);
    return rows as { number: number; text: string }[];
  }

  tables(): TableSchema[] {
    const rows = this.db.prepare('SELECT * FROM table_catalog ORDER BY path COLLATE NOCASE, rowid').all() as CatalogRow[];
    return rows.map(toTableSchema);
  }

  tableRows(table: string): TableRowRecord[] {
    const entry = this.db.prepare('SELECT name, columns FROM table_catalog WHERE name = ? COLLATE NOCASE').get(table) as
      | Pick<CatalogRow, 'name' | 'columns'>
      | undefined;
    if (!entry) return [];
    const columns = JSON.parse(entry.columns) as TableColumn[];
    const rows = this.db.prepare(`SELECT * FROM ${quoteIdentifier(entry.name)} ORDER BY _rowid_`).all() as Record<string, CleanValue>[];
    return rows.map((row) => ({
      values: Object.fromEntries(columns.map((column) => [column.name, row[column.name] ?? null])),
      sheetRow: (row[META_COLUMNS.sheetRow] ?? null) as number | null,
      page: (row[META_COLUMNS.page] ?? null) as number | null,
      isTotal: row[META_COLUMNS.isTotal] === 1,
      section: (row[META_COLUMNS.section] ?? null) as string | null,
    }));
  }

  query(sql: string, options: { maxRows: number; timeoutMs: number }): Promise<QueryResult> {
    return this.runner.run(sql, options);
  }

  sheetRows(path: string, sheet: string, from: number, to: number): { totalRows: number; columnCount: number; rows: SheetRow[] } {
    const { totalRows, columnCount } = this.db
      .prepare(
        `SELECT count(*) AS totalRows, coalesce(max(json_array_length(cells)), 0) AS columnCount
         FROM sheet_rows WHERE path = ? AND sheet = ?`,
      )
      .get(path, sheet) as { totalRows: number; columnCount: number };
    const rows = this.db
      .prepare('SELECT row_number AS rowNumber, cells FROM sheet_rows WHERE path = ? AND sheet = ? AND row_number BETWEEN ? AND ? ORDER BY row_number')
      .all(path, sheet, from, to) as { rowNumber: number; cells: string }[];
    return { totalRows, columnCount, rows: rows.map((row) => ({ rowNumber: row.rowNumber, cells: JSON.parse(row.cells) as CleanValue[] })) };
  }

  close(): void {
    this.runner.close();
    if (this.db.open) this.db.close();
  }

  /** Removes a path everywhere it appears; runs inside the caller's transaction. */
  private deleteDocument(path: string): void {
    dropTables(this.db, path);
    for (const table of ['chunks', 'pages', 'sheet_rows', 'documents']) {
      this.db.prepare(`DELETE FROM ${table} WHERE path = ?`).run(path);
    }
  }

  private documentRows(): DocumentRow[] {
    return this.db.prepare('SELECT * FROM documents ORDER BY path COLLATE NOCASE').all() as DocumentRow[];
  }

  private tablesOf(path: string): TableSchema[] {
    const rows = this.db.prepare('SELECT * FROM table_catalog WHERE path = ? ORDER BY rowid').all(path) as CatalogRow[];
    return rows.map(toTableSchema);
  }

  /** A document filter as a stored path; a name or path that matches nothing still filters, to nothing. */
  private scope(document: string | null): string | null {
    return document === null ? null : (this.find(document)?.path ?? document);
  }

  private cachedVectors(): CachedVector[] {
    if (this.vectors) return this.vectors;
    const rows = this.db.prepare('SELECT id, path, page, embedding FROM chunks WHERE embedding IS NOT NULL ORDER BY id').all() as {
      id: number;
      path: string;
      page: number;
      embedding: Buffer;
    }[];
    this.vectors = rows.map((row) => {
      const vector = bufferToVector(row.embedding);
      return { chunkId: row.id, path: row.path, page: row.page, vector, magnitude: magnitude(vector) };
    });
    return this.vectors;
  }
}
