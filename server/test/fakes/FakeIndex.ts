import type { Classification, DocumentSummary } from '@atlas/shared';
import { documentId } from '../../src/domain/documentId';
import { sqlIdentifier } from '../../src/domain/table';
import type {
  DocumentIndex,
  DocumentRecord,
  Fingerprint,
  QueryResult,
  SearchHit,
  SheetRow,
  TableRowRecord,
  TableSchema,
} from '../../src/application/ports/DocumentIndex';

interface Chunk {
  id: number;
  document: string;
  page: number;
  text: string;
  vector: Float32Array | null;
}

/**
 * In-memory DocumentIndex for unit tests. Keyword search is a word-overlap count, vector search is cosine,
 * and `query` runs whatever `onQuery` returns, so tests decide the SQL result.
 */
export class FakeIndex implements DocumentIndex {
  onQuery: (sql: string) => QueryResult = () => ({ columns: [], rows: [], truncated: false });
  readonly queries: string[] = [];
  private readonly records = new Map<string, DocumentRecord>();
  private readonly classifications = new Map<string, Classification | null>();
  private chunks: Chunk[] = [];
  private nextChunk = 1;

  fingerprint(path: string): Fingerprint | null {
    return this.records.get(path)?.fingerprint ?? null;
  }

  save(record: DocumentRecord): void {
    this.remove(record.path);
    this.records.set(record.path, record);
    for (const chunk of record.chunks) {
      this.chunks.push({ id: this.nextChunk++, document: record.path, page: chunk.page, text: chunk.text, vector: null });
    }
  }

  remove(path: string): void {
    this.records.delete(path);
    this.chunks = this.chunks.filter((chunk) => chunk.document !== path);
  }

  documents(): DocumentSummary[] {
    return [...this.records.values()].map((record) => this.summary(record));
  }

  find(nameOrPath: string): DocumentSummary | null {
    const wanted = nameOrPath.toLowerCase();
    return this.documents().find((doc) => doc.path.toLowerCase() === wanted || doc.name.toLowerCase() === wanted) ?? null;
  }

  setClassification(path: string, classification: Classification | null): void {
    this.classifications.set(path, classification);
  }

  pendingEmbeddings(limit: number): { chunkId: number; text: string }[] {
    return this.chunks
      .filter((chunk) => chunk.vector === null)
      .slice(0, limit)
      .map((chunk) => ({ chunkId: chunk.id, text: chunk.text }));
  }

  saveEmbeddings(items: { chunkId: number; vector: Float32Array }[]): void {
    for (const item of items) {
      const chunk = this.chunks.find((candidate) => candidate.id === item.chunkId);
      if (chunk) chunk.vector = item.vector;
    }
  }

  keywordSearch(query: string, options: { document: string | null; limit: number }): SearchHit[] {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return this.inScope(options.document)
      .map((chunk) => ({ chunk, score: words.filter((word) => chunk.text.toLowerCase().includes(word)).length }))
      .filter((hit) => hit.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit)
      .map(({ chunk, score }) => toHit(chunk, score));
  }

  vectorSearch(vector: Float32Array, options: { document: string | null; limit: number }): SearchHit[] {
    return this.inScope(options.document)
      .filter((chunk) => chunk.vector !== null)
      .map((chunk) => ({ chunk, score: cosine(vector, chunk.vector as Float32Array) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit)
      .map(({ chunk, score }) => toHit(chunk, score));
  }

  readPages(path: string, from: number, to: number): { number: number; text: string }[] {
    return (this.records.get(path)?.pages ?? []).filter((page) => page.number >= from && page.number <= to);
  }

  tables(): TableSchema[] {
    return [...this.records.values()].flatMap((record) => this.tableSchemas(record));
  }

  tableRows(table: string): TableRowRecord[] {
    for (const record of this.records.values()) {
      const schemas = this.tableSchemas(record);
      const position = schemas.findIndex((schema) => schema.name === table);
      const source = record.tables[position];
      if (position >= 0 && source) {
        return source.rows.map((row) => ({
          values: Object.fromEntries(source.columns.map((column, i) => [column.name, row.values[i] ?? null])),
          sheetRow: row.sheetRow,
          page: row.page,
          isTotal: row.isTotal,
          section: row.section,
        }));
      }
    }
    return [];
  }

  async query(sql: string): Promise<QueryResult> {
    this.queries.push(sql);
    return this.onQuery(sql);
  }

  sheetRows(path: string, sheet: string, from: number, to: number): { totalRows: number; columnCount: number; rows: SheetRow[] } {
    const rows = this.records.get(path)?.sheetRows.find((entry) => entry.sheet === sheet)?.rows ?? [];
    return {
      totalRows: rows.length,
      columnCount: Math.max(0, ...rows.map((row) => row.cells.length)),
      rows: rows.filter((row) => row.rowNumber >= from && row.rowNumber <= to),
    };
  }

  close(): void {}

  private inScope(document: string | null): Chunk[] {
    const path = document === null ? null : (this.find(document)?.path ?? document);
    return path === null ? this.chunks : this.chunks.filter((chunk) => chunk.document === path);
  }

  private tableSchemas(record: DocumentRecord): TableSchema[] {
    const base = sqlIdentifier(record.name.replace(/\.[^.]+$/, ''), 'doc');
    return record.tables.map((table, i) => ({
      name: `${base}_${i + 1}`,
      document: record.path,
      title: table.title,
      sheet: table.sheet,
      pageFrom: table.pageFrom,
      pageTo: table.pageTo,
      columns: table.columns.map(({ name, label, type }) => ({ name, label, type })),
      rowCount: table.rows.length,
      currency: table.currency,
    }));
  }

  private summary(record: DocumentRecord): DocumentSummary {
    const { pages, chunks, sheetRows, fingerprint, tables, ...rest } = record;
    return {
      ...rest,
      id: documentId(record.path),
      sizeBytes: fingerprint.size,
      tables: this.tableSchemas(record).map(({ document, ...table }) => table),
      classification: this.classifications.get(record.path) ?? null,
    };
  }
}

function toHit(chunk: Chunk, score: number): SearchHit {
  return { chunkId: chunk.id, document: chunk.document, page: chunk.page, text: chunk.text, score };
}

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  return normA === 0 || normB === 0 ? 0 : dot / Math.sqrt(normA * normB);
}
