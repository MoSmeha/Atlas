import { mkdtempSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DocumentSummary } from '@atlas/shared';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DocumentRecord } from '../../src/application/ports/DocumentIndex';
import { documentId } from '../../src/domain/documentId';
import type { CleanTable } from '../../src/domain/table';
import type { SqliteIndex } from '../../src/infrastructure/index/SqliteIndex';
import { SqliteIndexFactory } from '../../src/infrastructure/index/SqliteIndexFactory';
import { boqTable, excelRecord, pdfRecord } from '../fakes/records';

let dataDir: string;
let factory: SqliteIndexFactory;
let opened: SqliteIndex[];
const folder = 'C:/Projects/Riyadh Tower';

function open(path = folder): SqliteIndex {
  const index = factory.open(path);
  opened.push(index);
  return index;
}

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'atlas-index-'));
  factory = new SqliteIndexFactory(dataDir);
  opened = [];
});

afterEach(async () => {
  for (const index of opened) index.close();
  // A killed query process can hold the file for a moment on Windows.
  await rm(dataDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
});

const boq = (sheet = 'Bill 1') =>
  boqTable(
    [
      ['A1', 'Bored piles 600 mm', 10, 2000, 20000],
      ['A2', 'Pile caps', 4, 500, 2000],
      ['A3', 'Blinding concrete', 20, 25, 500],
    ],
    sheet,
  );

describe('SqliteIndex storage', () => {
  it('saves, finds, replaces and removes a document', () => {
    const index = open();
    index.save(pdfRecord('contracts/Main Contract.pdf', ['Scope of works', 'Payment terms within 30 days']));

    expect(index.find('main contract.PDF')?.path).toBe('contracts/Main Contract.pdf');
    expect(index.find('contracts\\main contract.pdf')?.path).toBe('contracts/Main Contract.pdf');
    expect(index.find('other.pdf')).toBeNull();
    expect(index.readPages('contracts/Main Contract.pdf', 2, 9)).toEqual([{ number: 2, text: 'Payment terms within 30 days' }]);

    index.save({ ...pdfRecord('contracts/Main Contract.pdf', ['Revised scope', 'Retention of five percent']), fingerprint: { mtimeMs: 2, size: 2000 } });
    expect(index.documents()).toHaveLength(1);
    expect(index.fingerprint('contracts/Main Contract.pdf')).toEqual({ mtimeMs: 2, size: 2000 });
    expect(index.keywordSearch('payment', { document: null, limit: 5 })).toEqual([]);
    expect(index.keywordSearch('retention', { document: null, limit: 5 })[0]?.page).toBe(2);

    index.remove('contracts/Main Contract.pdf');
    expect(index.find('Main Contract.pdf')).toBeNull();
    expect(index.fingerprint('contracts/Main Contract.pdf')).toBeNull();
    expect(index.readPages('contracts/Main Contract.pdf', 1, 9)).toEqual([]);
    expect(index.keywordSearch('retention', { document: null, limit: 5 })).toEqual([]);
  });

  it('lists documents in the register shape, with tables and classification', () => {
    const index = open();
    const workbook: DocumentRecord = { ...excelRecord('BOQ/Tender BOQ.xlsx', [boq()]), fingerprint: { mtimeMs: 5, size: 4096 } };
    const broken: DocumentRecord = {
      ...pdfRecord('Old.pdf', []),
      status: 'corrupt',
      statusDetail: 'The file is damaged.',
      pageCount: null,
      language: null,
    };
    index.save(workbook);
    index.save(broken);
    index.setClassification('BOQ/Tender BOQ.xlsx', {
      type: 'BOQ',
      confidence: 0.9,
      metadata: { projectName: 'Riyadh Tower', parties: [], contractValue: null, keyDates: [] },
    });

    const documents = index.documents();
    for (const document of documents) DocumentSummary.parse(document);
    expect(documents.map((document) => document.path)).toEqual(['BOQ/Tender BOQ.xlsx', 'Old.pdf']);
    expect(documents[0]).toEqual({
      id: documentId('BOQ/Tender BOQ.xlsx'),
      name: 'Tender BOQ.xlsx',
      path: 'BOQ/Tender BOQ.xlsx',
      kind: 'excel',
      status: 'ok',
      statusDetail: null,
      sizeBytes: 4096,
      pageCount: null,
      scannedPages: [],
      sheets: ['Bill 1'],
      tables: [
        {
          name: 't_tender_boq_bill_1',
          title: 'Bill of Quantities',
          sheet: 'Bill 1',
          pageFrom: null,
          pageTo: null,
          columns: [
            { name: 'item_code', label: 'Item', type: 'text' },
            { name: 'description', label: 'Description', type: 'text' },
            { name: 'quantity', label: 'Qty', type: 'number' },
            { name: 'rate', label: 'Rate', type: 'number' },
            { name: 'amount', label: 'Amount', type: 'number' },
          ],
          rowCount: 3,
          currency: 'SAR',
        },
      ],
      currencies: ['SAR'],
      language: 'en',
      classification: { type: 'BOQ', confidence: 0.9, metadata: { projectName: 'Riyadh Tower', parties: [], contractValue: null, keyDates: [] } },
    });
    expect(documents[1]).toMatchObject({ status: 'corrupt', statusDetail: 'The file is damaged.', tables: [], classification: null });
  });

  it('pages through sheet rows by Excel row number', () => {
    const index = open();
    const rows = Array.from({ length: 25 }, (_, i) => ({ rowNumber: i + 1, cells: i === 0 ? ['Item', 'Amount', 'Note'] : [`A${i}`, i * 100] }));
    index.save({ ...excelRecord('Ledger.xlsx', []), sheets: ['Ledger'], sheetRows: [{ sheet: 'Ledger', rows }] });

    const page = index.sheetRows('Ledger.xlsx', 'Ledger', 11, 20);
    expect(page.totalRows).toBe(25);
    expect(page.columnCount).toBe(3);
    expect(page.rows.map((row) => row.rowNumber)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(page.rows[0]).toEqual({ rowNumber: 11, cells: ['A10', 1000] });
    expect(index.sheetRows('Ledger.xlsx', 'Ledger', 24, 100).rows.map((row) => row.rowNumber)).toEqual([24, 25]);
    expect(index.sheetRows('Ledger.xlsx', 'Missing', 1, 10)).toEqual({ totalRows: 0, columnCount: 0, rows: [] });
  });
});

describe('SqliteIndex keyword search', () => {
  it('ranks English chunks with bm25 and can stay inside one document', () => {
    const index = open();
    index.save(pdfRecord('Spec.pdf', ['General requirements', 'Concrete grade C40 for concrete piles and concrete caps', 'Concrete curing']));
    index.save(pdfRecord('Contract.pdf', ['Concrete works are measured per cubic metre']));

    const hits = index.keywordSearch('concrete piles', { document: null, limit: 10 });
    expect(hits[0]).toMatchObject({ document: 'Spec.pdf', page: 2, text: 'Concrete grade C40 for concrete piles and concrete caps' });
    expect(hits.map((hit) => hit.score)).toEqual([...hits.map((hit) => hit.score)].sort((a, b) => b - a));
    expect(hits.every((hit) => hit.score > 0)).toBe(true);

    const scoped = index.keywordSearch('concrete', { document: 'contract.pdf', limit: 10 });
    expect(scoped.map((hit) => hit.document)).toEqual(['Contract.pdf']);
    expect(index.keywordSearch('concrete', { document: null, limit: 2 })).toHaveLength(2);
    expect(index.keywordSearch('C40', { document: null, limit: 5 })[0]?.page).toBe(2);
  });

  it('treats FTS5 syntax in the query as plain words', () => {
    const index = open();
    index.save(pdfRecord('Spec.pdf', ['Concrete NOT steel', 'Steel reinforcement']));
    expect(() => index.keywordSearch('concrete" OR NEAR( * ^ :', { document: null, limit: 5 })).not.toThrow();
    expect(index.keywordSearch('?!', { document: null, limit: 5 })).toEqual([]);
  });

  it('finds Arabic text with or without vowels, hamza forms and the article', () => {
    const index = open();
    index.save(
      pdfRecord('عقد المشروع.pdf', [
        'يجب على المُقَاوِل تقديم ضمان حسن التنفيذ بقيمة ١٠٪ من قيمة العقد.',
        'أعمال الخرسانة المسلحة للأساسات',
      ]),
    );
    const page = (query: string) => index.keywordSearch(query, { document: null, limit: 5 })[0]?.page ?? null;
    expect(page('المقاول')).toBe(1);
    expect(page('مقاول')).toBe(1);
    expect(page('الضمان')).toBe(1);
    expect(page('10')).toBe(1);
    expect(page('اعمال الخرسانه')).toBe(2);
    expect(page('الأساسات')).toBe(2);
    expect(page('الإجمالية')).toBeNull();
    expect(index.find('عقد المشروع.pdf')?.name).toBe('عقد المشروع.pdf');
  });
});

describe('SqliteIndex pending embeddings', () => {
  it('counts chunks without an embedding and hands them out in batches', () => {
    const index = open();
    index.save(pdfRecord('A.pdf', ['one', 'two', 'three']));
    expect(index.pendingEmbeddingCount()).toBe(3);

    const first = index.pendingEmbeddings(2);
    expect(first.map((chunk) => chunk.text)).toEqual(['one', 'two']);
    index.saveEmbeddings(first.map((chunk) => ({ chunkId: chunk.chunkId, vector: new Float32Array([1, 0]) })));
    expect(index.pendingEmbeddingCount()).toBe(1);
    expect(index.pendingEmbeddings(2).map((chunk) => chunk.text)).toEqual(['three']);

    index.remove('A.pdf');
    expect(index.pendingEmbeddingCount()).toBe(0);
  });
});

describe('SqliteIndex vector search', () => {
  it('orders chunks by cosine similarity and refreshes after changes', () => {
    const index = open();
    index.save(pdfRecord('A.pdf', ['north', 'east']));
    index.save(pdfRecord('B.pdf', ['north east']));

    const pending = index.pendingEmbeddings(10);
    expect(pending.map((chunk) => chunk.text)).toEqual(['north', 'east', 'north east']);
    const vectors: Record<string, number[]> = { north: [1, 0, 0], east: [0, 1, 0], 'north east': [0.7, 0.7, 0] };
    index.saveEmbeddings(pending.map((chunk) => ({ chunkId: chunk.chunkId, vector: new Float32Array(vectors[chunk.text] ?? []) })));
    expect(index.pendingEmbeddings(10)).toEqual([]);

    const query = new Float32Array([0.9, 0.3, 0]);
    expect(index.vectorSearch(query, { document: null, limit: 3 }).map((hit) => hit.text)).toEqual(['north', 'north east', 'east']);
    expect(index.vectorSearch(query, { document: 'A.pdf', limit: 3 }).map((hit) => hit.text)).toEqual(['north', 'east']);
    expect(index.vectorSearch(query, { document: null, limit: 1 })[0]).toMatchObject({ document: 'A.pdf', page: 1 });

    const stale = pending[0]?.chunkId ?? 0;
    index.save(pdfRecord('A.pdf', ['south']));
    expect(index.vectorSearch(query, { document: null, limit: 3 }).map((hit) => hit.text)).toEqual(['north east']);
    index.saveEmbeddings([{ chunkId: stale, vector: new Float32Array([1, 0, 0]) }]);
    expect(index.pendingEmbeddings(10).map((chunk) => chunk.text)).toEqual(['south']);
  });
});

describe('SqliteIndex SQL tables', () => {
  it('creates a real table with meta columns and queries it', async () => {
    const index = open();
    const table: CleanTable = {
      ...boq(),
      rows: [
        ...boq().rows,
        { values: [null, 'Total Bill 1', null, null, 22500], sheetRow: 8, page: null, isTotal: true, section: 'Bill 1 - Piling' },
      ],
    };
    index.save(excelRecord('Tender BOQ.xlsx', [table]));

    expect(index.tables()).toMatchObject([{ name: 't_tender_boq_bill_1', document: 'Tender BOQ.xlsx', rowCount: 4, currency: 'SAR' }]);
    const result = await index.query(
      'SELECT item_code, amount, _row, _page, _is_total, _section FROM t_tender_boq_bill_1 WHERE amount > 1000 AND _is_total = 0 ORDER BY _row;',
      { maxRows: 100, timeoutMs: 5000 },
    );
    expect(result).toEqual({
      columns: ['item_code', 'amount', '_row', '_page', '_is_total', '_section'],
      rows: [
        ['A1', 20000, 5, null, 0, null],
        ['A2', 2000, 6, null, 0, null],
      ],
      truncated: false,
    });
    const total = await index.query('SELECT sum(amount) AS total FROM t_tender_boq_bill_1 WHERE _is_total = 0', { maxRows: 10, timeoutMs: 5000 });
    expect(total.rows).toEqual([[22500]]);

    const rows = index.tableRows('t_tender_boq_bill_1');
    expect(rows[0]).toEqual({
      values: { item_code: 'A1', description: 'Bored piles 600 mm', quantity: 10, rate: 2000, amount: 20000 },
      sheetRow: 5,
      page: null,
      isTotal: false,
      section: null,
    });
    expect(rows[3]).toMatchObject({ isTotal: true, section: 'Bill 1 - Piling', sheetRow: 8 });
    expect(index.tableRows('t_missing')).toEqual([]);
  });

  it('names tables per sheet or page, numbers clashes and drops them with their document', () => {
    const index = open();
    const pdfTable: CleanTable = { ...boq(), sheet: null, pageFrom: 3, pageTo: 4 };
    index.save(excelRecord('2024 BOQ.xlsx', [boq('Bill 1'), boq('Bill 1'), boq('ملخص')]));
    index.save({ ...pdfRecord('Spec.pdf', ['a', 'b', 'c', 'd']), tables: [pdfTable] });
    index.save(excelRecord('rev2/2024 BOQ.xlsx', [boq('Bill 1')]));

    expect(index.tables().map((table) => table.name)).toEqual([
      't_2024_boq_bill_1',
      't_2024_boq_bill_1_2',
      't_2024_boq_sheet',
      't_2024_boq_bill_1_3',
      't_spec_p3',
    ]);
    index.remove('2024 BOQ.xlsx');
    expect(index.tables().map((table) => table.name)).toEqual(['t_2024_boq_bill_1_3', 't_spec_p3']);
    expect(index.tableRows('t_2024_boq_bill_1')).toEqual([]);
  });

  it('rejects anything that is not a read-only SELECT', async () => {
    const index = open();
    index.save(excelRecord('BOQ.xlsx', [boq()]));
    const attempts = [
      "INSERT INTO t_boq_bill_1 (item_code) VALUES ('X1')",
      'DELETE FROM t_boq_bill_1',
      'UPDATE t_boq_bill_1 SET amount = 0',
      'DROP TABLE t_boq_bill_1',
      'CREATE TABLE t_new (a)',
      "ATTACH DATABASE 'other.sqlite' AS other",
      'PRAGMA user_version = 7',
      'PRAGMA journal_mode = DELETE',
      'PRAGMA query_only = OFF',
      'SELECT 1; DELETE FROM t_boq_bill_1',
    ];
    for (const sql of attempts) {
      await expect(index.query(sql, { maxRows: 10, timeoutMs: 5000 }), sql).rejects.toMatchObject({ code: 'invalid_request' });
    }
    await expect(index.query('SELEC 1', { maxRows: 10, timeoutMs: 5000 })).rejects.toThrow(/syntax error/);
    const count = await index.query('SELECT count(*) FROM t_boq_bill_1', { maxRows: 10, timeoutMs: 5000 });
    expect(count.rows).toEqual([[3]]);
  });

  it('caps rows and flags the cut', async () => {
    const index = open();
    index.save(excelRecord('BOQ.xlsx', [boq()]));
    const capped = await index.query('SELECT item_code FROM t_boq_bill_1 ORDER BY _row', { maxRows: 2, timeoutMs: 5000 });
    expect(capped).toEqual({ columns: ['item_code'], rows: [['A1'], ['A2']], truncated: true });
    const exact = await index.query('SELECT item_code FROM t_boq_bill_1', { maxRows: 3, timeoutMs: 5000 });
    expect(exact.truncated).toBe(false);
  });

  it('stops a runaway query at the timeout and keeps working', async () => {
    const index = open();
    index.save(excelRecord('BOQ.xlsx', [boq()]));
    const started = Date.now();
    await expect(
      index.query('WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n) SELECT count(*) FROM n', { maxRows: 10, timeoutMs: 200 }),
    ).rejects.toMatchObject({ code: 'invalid_request', message: 'The query took longer than 0.2 seconds and was stopped.' });
    expect(Date.now() - started).toBeLessThan(3000);
    const after = await index.query('SELECT count(*) FROM t_boq_bill_1', { maxRows: 10, timeoutMs: 5000 });
    expect(after.rows).toEqual([[3]]);
  });

  it('sees tables saved after the query connection opened', async () => {
    const index = open();
    index.save(excelRecord('BOQ.xlsx', [boq()]));
    await index.query('SELECT 1', { maxRows: 1, timeoutMs: 5000 });
    index.save(excelRecord('Variation.xlsx', [boq('VO 1')]));
    const result = await index.query('SELECT count(*) FROM t_variation_vo_1', { maxRows: 1, timeoutMs: 5000 });
    expect(result.rows).toEqual([[3]]);
  });
});

describe('SqliteIndexFactory', () => {
  it('keeps one file per folder and reads fingerprints back after reopening', () => {
    const first = open();
    first.save({ ...pdfRecord('a.pdf', ['text']), fingerprint: { mtimeMs: 1730000000123.5, size: 52344 } });
    first.close();

    expect(factory.fileFor(folder)).toMatch(/[\\/]indexes[\\/][0-9a-f]{16}\.sqlite$/);
    expect(factory.fileFor(`${folder}/`)).toBe(factory.fileFor(folder));
    expect(factory.fileFor('C:/Projects/Other')).not.toBe(factory.fileFor(folder));
    if (process.platform === 'win32') expect(factory.fileFor(folder.toUpperCase())).toBe(factory.fileFor(folder));

    const again = open();
    expect(again.fingerprint('a.pdf')).toEqual({ mtimeMs: 1730000000123.5, size: 52344 });
    expect(again.keywordSearch('text', { document: null, limit: 1 })[0]?.document).toBe('a.pdf');
    expect(open('C:/Projects/Other').documents()).toEqual([]);
  });

  it('rebuilds an index written by another schema version or damaged on disk', () => {
    const index = open();
    index.save(pdfRecord('a.pdf', ['text']));
    index.close();

    const raw = new Database(factory.fileFor(folder));
    raw.prepare("UPDATE meta SET value = '0' WHERE key = 'schema_version'").run();
    raw.close();
    expect(open().documents()).toEqual([]);

    for (const index of opened) index.close();
    writeFileSync(factory.fileFor('C:/Projects/Damaged'), 'this is not a database, just some text that is long enough');
    const recovered = open('C:/Projects/Damaged');
    recovered.save(pdfRecord('b.pdf', ['fresh']));
    expect(recovered.documents().map((document) => document.path)).toEqual(['b.pdf']);
  });
});
