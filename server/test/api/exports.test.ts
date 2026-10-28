import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/app';
import { ExportResult } from '../../src/application/ExportResult';
import { SessionStore } from '../../src/application/session/SessionStore';
import { XlsxExporter } from '../../src/infrastructure/export/XlsxExporter';
import { makeApiDeps } from '../fakes/apiDeps';
import { FakeClock } from '../fakes/FakeClock';

const root = mkdtempSync(join(tmpdir(), 'atlas-exports-api-'));
const exportsDir = join(root, 'exports');
mkdirSync(exportsDir);
writeFileSync(join(root, 'secret.csv'), 'outside the exports folder');
writeFileSync(join(exportsDir, 'notes.txt'), 'not an export');

const sessions = new SessionStore();
const saved = sessions.get('s1').saveResult({
  title: 'BOQ items above 1M',
  columns: ['item_code', 'amount'],
  rows: [['A1', 2000000]],
  sources: [{ kind: 'excel', document: 'BOQ.xlsx', sheet: 'Bill 1', rowFrom: 5, rowTo: 5 }],
  tool: 'query_tables',
  detail: null,
});

const app = buildApp(
  makeApiDeps({
    exports: {
      sessions,
      exportResult: new ExportResult(new XlsxExporter(), new FakeClock('2026-10-28T14:05:09')),
      exportsDir,
    },
  }),
);

afterAll(() => app.close());

function postExport(body: object) {
  return app.inject({ method: 'POST', url: '/api/exports', payload: body });
}

describe('POST /api/exports', () => {
  it('exports a saved result and returns its download link', async () => {
    const response = await postExport({ sessionId: 's1', resultId: saved.id, format: 'xlsx' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.fileName).toMatch(/^boq-items-above-1m-20261028-140509(-\d+)?\.xlsx$/);
    expect(body.url).toBe(`/api/exports/${body.fileName}`);
    expect(dirname(body.path)).toBe(exportsDir);
    expect(existsSync(body.path)).toBe(true);
  });

  it('reports an unknown result id', async () => {
    const response = await postExport({ sessionId: 's1', resultId: 'r99', format: 'xlsx' });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('result_not_found');
  });

  it('rejects an unsupported format', async () => {
    const response = await postExport({ sessionId: 's1', resultId: saved.id, format: 'pdf' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('invalid_request');
  });
});

describe('GET /api/exports/:fileName', () => {
  it('downloads an exported workbook', async () => {
    const { url, fileName } = (await postExport({ sessionId: 's1', resultId: saved.id, format: 'xlsx' })).json();
    const response = await app.inject({ method: 'GET', url });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(response.headers['content-disposition']).toBe(`attachment; filename="${fileName}"`);
    expect(response.rawPayload.subarray(0, 2).toString('latin1')).toBe('PK');
  });

  it('downloads an exported CSV file with its byte order mark', async () => {
    const { url } = (await postExport({ sessionId: 's1', resultId: saved.id, format: 'csv' })).json();
    const response = await app.inject({ method: 'GET', url });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect([...response.rawPayload.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(response.rawPayload.subarray(3).toString('utf8')).toBe('item_code,amount\r\nA1,2000000\r\n');
  });

  it('returns 404 for an export that does not exist', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/exports/missing-20261028-140509.xlsx' });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.message).toMatch(/No exported file/);
  });

  it.each([
    ['..%2Fsecret.csv'],
    ['..%5Csecret.csv'],
    ['%2E%2E%2F%2E%2E%2Fpackage.json'],
    ['..'],
    ['notes.txt'],
    ['.hidden.csv'],
    ['C%3A%5CWindows%5Cwin.ini'],
    ['boq.xlsx%3Astream'],
  ])('rejects %s without reading outside the exports folder', async (name) => {
    const response = await app.inject({ method: 'GET', url: `/api/exports/${name}` });
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect(response.statusCode).toBeLessThan(500);
    expect(response.body).not.toContain('outside the exports folder');
    expect(response.body).not.toContain('not an export');
  });

  it('answers a traversal attempt with invalid_request', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/exports/..%2Fsecret.csv' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('invalid_request');
  });
});
