import { existsSync, mkdirSync, mkdtempSync, statSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type DocumentSummary, IndexStatus, SheetRows } from '@atlas/shared';
import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/app';
import { IndexFolder } from '../../src/application/indexing/IndexFolder';
import { Workspace } from '../../src/application/workspace/Workspace';
import { NodeFileSystem } from '../../src/infrastructure/fs/NodeFileSystem';
import { SqliteIndexFactory } from '../../src/infrastructure/index/SqliteIndexFactory';
import { ExcelJsReader } from '../../src/infrastructure/readers/ExcelJsReader';
import { makeApiDeps } from '../fakes/apiDeps';
import { FakeFolderPicker } from '../fakes/FakeFolderPicker';
import { FakeClock } from '../fakes/FakeClock';
import { MemoryRunLogger } from '../fakes/MemoryRunLogger';

const root = mkdtempSync(join(tmpdir(), 'atlas-folder-api-'));
const project = join(root, 'project');
const docsOnly = join(root, 'letters');
mkdirSync(project);
mkdirSync(docsOnly);
writeFileSync(join(docsOnly, 'Cover_Letter.docx'), 'not a real docx');

const workspace = new Workspace();
const folderPicker = new FakeFolderPicker();
const indexFolder = new IndexFolder({
  fs: new NodeFileSystem(),
  readers: [new ExcelJsReader()],
  indexes: new SqliteIndexFactory(join(root, 'data')),
  embeddings: null,
  workspace,
  logger: new MemoryRunLogger(),
  clock: new FakeClock(),
  maxFileBytes: 10 * 1024 * 1024,
});
const app = buildApp(
  makeApiDeps({
    folder: { indexFolder, workspace, repoRoot: root, folderPicker },
    documents: { workspace },
  }),
);

/** A BOQ sheet with a title row, a header and two items, and a long sheet of 600 numbered rows. */
async function writeWorkbook(path: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const bill = workbook.addWorksheet('Bill 1');
  bill.addRow(['Bill of Quantities - Phase 1']);
  bill.addRow(['Item', 'Description', 'Unit', 'Qty', 'Rate', 'Amount (SAR)']);
  bill.addRow(['1.01', 'Site clearance', 'm2', 8400, 6.5, 54_600]);
  bill.addRow(['1.02', 'Bulk excavation', 'm3', 96_000, 42, 4_032_000]);
  const long = workbook.addWorksheet('Long');
  for (let i = 1; i <= 600; i++) long.addRow([i, `Row ${i}`]);
  await workbook.xlsx.writeFile(path);
}

const loadFolder = (path: string) => app.inject({ method: 'POST', url: '/api/folder', payload: { path } });
const getStatus = async () => IndexStatus.parse((await app.inject({ method: 'GET', url: '/api/folder/status' })).json());

let boq: DocumentSummary;

beforeAll(async () => {
  await writeWorkbook(join(project, 'BOQ.xlsx'));
});

afterAll(async () => {
  await app.close();
  await indexFolder.idle();
  safeClose();
  await rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
});

function safeClose(): void {
  try {
    workspace.require().index.close();
  } catch {
    // Nothing loaded.
  }
}

describe('POST /api/folder', () => {
  it('reports a folder that does not exist', async () => {
    const response = await loadFolder(join(root, 'no-such-folder'));
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('folder_not_found');
  });

  it('reports a folder with no PDF or Excel file and lists what it holds', async () => {
    const response = await loadFolder(docsOnly);
    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({ code: 'folder_empty', message: `No PDF or Excel files in ${docsOnly} (1 other file skipped).` });
    const status = await getStatus();
    expect(status).toMatchObject({ folder: docsOnly, phase: 'error', error: { code: 'folder_empty' } });
    expect(status.documents.map((document) => [document.name, document.status])).toEqual([['Cover_Letter.docx', 'skipped']]);
  });

  it('rejects an empty path', async () => {
    const response = await loadFolder('""');
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('invalid_request');
  });

  it('starts indexing a folder, given relative to the repository root, and answers 202', async () => {
    const response = await loadFolder('project');
    expect(response.statusCode).toBe(202);
    const started = IndexStatus.parse(response.json());
    expect(started).toMatchObject({ folder: project, phase: 'scanning', error: null });

    await indexFolder.idle();
    const status = await getStatus();
    expect(status).toMatchObject({ folder: project, phase: 'ready', progress: null, error: null });
    expect(status.documents).toHaveLength(1);
    boq = status.documents[0] as DocumentSummary;
    expect(boq).toMatchObject({ name: 'BOQ.xlsx', path: 'BOQ.xlsx', kind: 'excel', status: 'ok', sheets: ['Bill 1', 'Long'], currencies: ['SAR'] });
    expect(boq.tables.find((table) => table.sheet === 'Bill 1')).toMatchObject({ rowCount: 2, currency: 'SAR' });
  });
});

describe('GET /api/documents/:id/sheets/:sheet/rows', () => {
  const rowsUrl = (sheet: string, query = '') => `/api/documents/${boq.id}/sheets/${encodeURIComponent(sheet)}/rows${query}`;

  it('returns raw rows numbered as Excel numbers them', async () => {
    const response = await app.inject({ method: 'GET', url: rowsUrl('Bill 1', '?from=2&to=3') });
    expect(response.statusCode).toBe(200);
    const body = SheetRows.parse(response.json());
    expect(body).toMatchObject({ document: 'BOQ.xlsx', sheet: 'Bill 1', totalRows: 4, columnCount: 6 });
    expect(body.rows).toEqual([
      { rowNumber: 2, cells: ['Item', 'Description', 'Unit', 'Qty', 'Rate', 'Amount (SAR)'] },
      { rowNumber: 3, cells: ['1.01', 'Site clearance', 'm2', 8400, 6.5, 54_600] },
    ]);
  });

  it('returns at most 500 rows per call', async () => {
    const body = SheetRows.parse((await app.inject({ method: 'GET', url: rowsUrl('Long', '?from=50&to=5000') })).json());
    expect(body.totalRows).toBe(600);
    expect(body.rows).toHaveLength(500);
    expect(body.rows[0]?.rowNumber).toBe(50);
    expect(body.rows.at(-1)?.rowNumber).toBe(549);
  });

  it('starts at row 1 when no range is given', async () => {
    const body = SheetRows.parse((await app.inject({ method: 'GET', url: rowsUrl('Bill 1') })).json());
    expect(body.rows.map((row) => row.rowNumber)).toEqual([1, 2, 3, 4]);
  });

  it('reports an unknown sheet or document', async () => {
    const sheet = await app.inject({ method: 'GET', url: rowsUrl('Bill 9') });
    expect(sheet.statusCode).toBe(404);
    expect(sheet.json().error).toMatchObject({ code: 'document_not_found', message: 'BOQ.xlsx has no sheet named "Bill 9".' });
    const document = await app.inject({ method: 'GET', url: '/api/documents/dnope/sheets/Bill%201/rows' });
    expect(document.statusCode).toBe(404);
    expect(document.json().error.code).toBe('document_not_found');
  });

  it('rejects a range that ends before it starts', async () => {
    const response = await app.inject({ method: 'GET', url: rowsUrl('Bill 1', '?from=5&to=2') });
    expect(response.statusCode).toBe(400);
  });
});

describe('GET /api/documents/:id/file', () => {
  it('streams the original workbook', async () => {
    const response = await app.inject({ method: 'GET', url: `/api/documents/${boq.id}/file` });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(response.headers['content-disposition']).toContain('filename="BOQ.xlsx"');
    expect(response.rawPayload.byteLength).toBe(statSync(join(project, 'BOQ.xlsx')).size);
  });

  it('reports an unknown document', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/documents/dnope/file' });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('document_not_found');
  });
});

describe('before a folder is loaded', () => {
  it('answers not_indexed for document routes and an idle status', async () => {
    const fresh = buildApp(makeApiDeps());
    const rows = await fresh.inject({ method: 'GET', url: '/api/documents/d1/sheets/Bill%201/rows' });
    expect(rows.statusCode).toBe(409);
    expect(rows.json().error.code).toBe('not_indexed');
    const status = await fresh.inject({ method: 'GET', url: '/api/folder/status' });
    expect(status.json()).toMatchObject({ folder: null, phase: 'idle', documents: [] });
    await fresh.close();
  });
});

describe('removing files and folders', () => {
  const removable = join(root, 'removable');
  const post = (url: string, path: string) => app.inject({ method: 'POST', url, payload: { path } });
  const paths = async () => (await getStatus()).documents.map((document) => document.path);

  it('removes a subfolder, keeps its files on disk and leaves it out until it is put back', async () => {
    mkdirSync(join(removable, 'Phase 2'), { recursive: true });
    await writeWorkbook(join(removable, 'BOQ.xlsx'));
    await writeWorkbook(join(removable, 'Phase 2', 'BOQ2.xlsx'));
    await loadFolder(removable);
    await indexFolder.idle();
    expect(await paths()).toEqual(['BOQ.xlsx', 'Phase 2/BOQ2.xlsx']);

    const removed = await post('/api/folder/remove', 'Phase 2');
    expect(removed.statusCode).toBe(200);
    expect(IndexStatus.parse(removed.json())).toMatchObject({ uploads: false, removed: ['Phase 2'] });
    expect(await paths()).toEqual(['BOQ.xlsx']);
    expect(existsSync(join(removable, 'Phase 2', 'BOQ2.xlsx'))).toBe(true);

    await loadFolder(removable);
    await indexFolder.idle();
    expect(await paths()).toEqual(['BOQ.xlsx']);

    const restored = await post('/api/folder/restore', 'Phase 2');
    expect(restored.statusCode).toBe(202);
    await indexFolder.idle();
    expect(await paths()).toEqual(['BOQ.xlsx', 'Phase 2/BOQ2.xlsx']);
    expect((await getStatus()).removed).toEqual([]);
  });

  it('answers 404 for a path that matches nothing and 400 for one outside the folder', async () => {
    expect((await post('/api/folder/remove', 'Nope.pdf')).statusCode).toBe(404);
    expect((await post('/api/folder/remove', '../project/BOQ.xlsx')).statusCode).toBe(400);
    expect((await post('/api/folder/restore', 'BOQ.xlsx')).statusCode).toBe(404);
  });

  it('removes the loaded folder and deletes its index, keeping the files', async () => {
    const response = await app.inject({ method: 'DELETE', url: '/api/folder' });
    expect(response.statusCode).toBe(200);
    expect(IndexStatus.parse(response.json())).toMatchObject({ folder: null, phase: 'idle', documents: [] });
    expect(existsSync(new SqliteIndexFactory(join(root, 'data')).fileFor(removable))).toBe(false);
    expect(existsSync(join(removable, 'BOQ.xlsx'))).toBe(true);

    const again = await app.inject({ method: 'DELETE', url: '/api/folder' });
    expect(again.json().error.code).toBe('not_indexed');
  });
});

describe('POST /api/folder/pick', () => {
  const pickFolder = (payload: object) => app.inject({ method: 'POST', url: '/api/folder/pick', payload });

  it('opens the folder window with the given title and answers with the chosen path', async () => {
    folderPicker.answer = project;
    const response = await pickFolder({ title: 'Choose the project folder' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ path: project });
    expect(folderPicker.titles.at(-1)).toBe('Choose the project folder');
  });

  it('answers null when the window was closed without a folder', async () => {
    folderPicker.answer = null;
    const response = await pickFolder({ title: 'اختر مجلد المشروع' });
    expect(response.json()).toEqual({ path: null });
    expect(folderPicker.titles.at(-1)).toBe('اختر مجلد المشروع');
  });

  it('needs a title', async () => {
    const response = await pickFolder({ title: ' ' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('invalid_request');
  });
});

describe('GET /api/folder/events', () => {
  it('streams index events as server-sent events until the client goes away', async () => {
    const events = new Workspace();
    const live = buildApp(makeApiDeps({ folder: { indexFolder, workspace: events, repoRoot: root, folderPicker } }));
    const address = await live.listen({ port: 0, host: '127.0.0.1' });
    const controller = new AbortController();
    try {
      const response = await fetch(`${address}/api/folder/events`, { signal: controller.signal });
      expect(response.headers.get('content-type')).toContain('text/event-stream');
      const reader = (response.body as ReadableStream<Uint8Array>).getReader();
      events.emit({ type: 'ready', folder: project });
      const { value } = await reader.read();
      expect(new TextDecoder().decode(value)).toBe(`data: ${JSON.stringify({ type: 'ready', folder: project })}\n\n`);
    } finally {
      controller.abort();
      await live.close();
    }
  });
});
