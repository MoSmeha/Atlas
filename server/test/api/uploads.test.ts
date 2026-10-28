import { existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IndexStatus } from '@atlas/shared';
import ExcelJS from 'exceljs';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/app';
import { IndexFolder } from '../../src/application/indexing/IndexFolder';
import { Workspace } from '../../src/application/workspace/Workspace';
import { NodeFileSystem } from '../../src/infrastructure/fs/NodeFileSystem';
import { SqliteIndexFactory } from '../../src/infrastructure/index/SqliteIndexFactory';
import { ExcelJsReader } from '../../src/infrastructure/readers/ExcelJsReader';
import { makeApiDeps } from '../fakes/apiDeps';
import { FakeClock } from '../fakes/FakeClock';
import { MemoryRunLogger } from '../fakes/MemoryRunLogger';

const MAX_BYTES = 64 * 1024;
const root = mkdtempSync(join(tmpdir(), 'atlas-uploads-api-'));
const uploadsDir = join(root, 'data', 'uploads');

const workspace = new Workspace();
const indexFolder = new IndexFolder({
  fs: new NodeFileSystem(),
  readers: [new ExcelJsReader()],
  indexes: new SqliteIndexFactory(join(root, 'data')),
  embeddings: null,
  workspace,
  logger: new MemoryRunLogger(),
  clock: new FakeClock(),
  maxFileBytes: MAX_BYTES,
});
const app = buildApp(
  makeApiDeps({
    folder: { indexFolder, workspace, repoRoot: root },
    documents: { workspace },
    uploads: { indexFolder, uploadsDir, maxFileBytes: MAX_BYTES },
  }),
);

afterAll(async () => {
  await app.close();
  await indexFolder.idle();
  workspace.require().index.close();
  await rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
});

async function workbookBytes(item: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Bill 1');
  sheet.addRow(['Item', 'Description', 'Unit', 'Qty', 'Rate', 'Amount (SAR)']);
  sheet.addRow([item, 'Site clearance', 'm2', 100, 6.5, 650]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

const BOUNDARY = 'atlas-test-boundary';

function upload(files: { name: string; data: Buffer }[]) {
  const parts = files.map((file) =>
    Buffer.concat([
      Buffer.from(
        `--${BOUNDARY}\r\nContent-Disposition: form-data; name="files"; filename="${file.name}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
      ),
      file.data,
      Buffer.from('\r\n'),
    ]),
  );
  return app.inject({
    method: 'POST',
    url: '/api/uploads',
    headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
    payload: Buffer.concat([...parts, Buffer.from(`--${BOUNDARY}--\r\n`)]),
  });
}

describe('POST /api/uploads', () => {
  it('saves the files into the uploads folder and loads it', async () => {
    const response = await upload([{ name: 'BOQ_Phase1.xlsx', data: await workbookBytes('1.01') }]);
    expect(response.statusCode).toBe(202);
    expect(IndexStatus.parse(response.json()).folder).toBe(uploadsDir);
    expect(existsSync(join(uploadsDir, 'BOQ_Phase1.xlsx'))).toBe(true);

    const status = await indexFolder.idle();
    expect(status.phase).toBe('ready');
    expect(status.documents.map((document) => [document.name, document.status])).toEqual([['BOQ_Phase1.xlsx', 'ok']]);
  });

  it('adds later uploads to the same folder and re-indexes it', async () => {
    const response = await upload([{ name: '../../escape/Rev1.xlsx', data: await workbookBytes('1.02') }]);
    expect(response.statusCode).toBe(202);
    const status = await indexFolder.idle();
    expect(status.documents.map((document) => document.name)).toEqual(['BOQ_Phase1.xlsx', 'Rev1.xlsx']);
    expect(existsSync(join(root, 'escape'))).toBe(false);
  });

  it('refuses a file over the size limit and keeps nothing from that upload', async () => {
    const response = await upload([
      { name: 'Small.xlsx', data: await workbookBytes('2.01') },
      { name: 'Huge.pdf', data: Buffer.alloc(MAX_BYTES + 1, 1) },
    ]);
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatchObject({ code: 'invalid_request', message: 'Huge.pdf is larger than the 0.1 MB limit, so nothing was uploaded.' });
    expect(readdirSync(uploadsDir).sort()).toEqual(['BOQ_Phase1.xlsx', 'Rev1.xlsx']);
  });

  it('asks for files when the form has none', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/uploads',
      headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
      payload: `--${BOUNDARY}\r\nContent-Disposition: form-data; name="note"\r\n\r\nhello\r\n--${BOUNDARY}--\r\n`,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.message).toBe('Choose at least one PDF or Excel file to upload.');
  });

  it('rejects a request that is not multipart', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/uploads', payload: { path: 'x' } });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('invalid_request');
  });
});
