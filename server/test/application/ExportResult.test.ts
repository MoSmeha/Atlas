import { describe, expect, it } from 'vitest';
import type { Source } from '@atlas/shared';
import { AppError } from '../../src/application/errors';
import { ExportResult } from '../../src/application/ExportResult';
import { Session } from '../../src/application/session/Session';
import { FakeClock } from '../fakes/FakeClock';
import { FakeExporter } from '../fakes/FakeOutputs';

const sources: Source[] = [{ kind: 'excel', document: 'BOQ.xlsx', sheet: 'Bill 1', rowFrom: 5, rowTo: 9 }];

function setup(title: string | null = 'BOQ items above 1M') {
  const exporter = new FakeExporter();
  // No "Z": the clock reads local time, so the file name does not depend on the machine's time zone.
  const useCase = new ExportResult(exporter, new FakeClock('2026-10-28T14:05:09'));
  const session = new Session('s1');
  const saved = session.saveResult({
    title,
    columns: ['item_code', 'amount'],
    rows: [['A1', 2000000]],
    sources,
    tool: 'query_tables',
    detail: 'SELECT item_code, amount FROM boq_1 WHERE amount > 1000000',
  });
  return { exporter, useCase, session, saved };
}

describe('ExportResult', () => {
  it('exports the saved rows and sources under a name built from the title and the time', async () => {
    const { exporter, useCase, session, saved } = setup();
    const file = await useCase.execute({ session, resultId: saved.id, format: 'xlsx', exportsDir: '/exports' });

    expect(file).toEqual({
      fileName: 'boq-items-above-1m-20261028-140509.xlsx',
      path: '/exports/boq-items-above-1m-20261028-140509.xlsx',
    });
    expect(exporter.exported).toHaveLength(1);
    expect(exporter.exported[0]?.format).toBe('xlsx');
    expect(exporter.exported[0]?.table).toEqual({
      title: 'BOQ items above 1M',
      columns: ['item_code', 'amount'],
      rows: [['A1', 2000000]],
      sources,
    });
  });

  it('leaves out the meta columns but keeps the sources they gave', async () => {
    const exporter = new FakeExporter();
    const useCase = new ExportResult(exporter, new FakeClock('2026-10-28T14:05:09'));
    const session = new Session('s1');
    const saved = session.saveResult({
      title: 'Items',
      columns: ['item_code', 'amount', '_row', '_page', '_section', 'excel_row'],
      rows: [['A1', 2000000, 5, null, 'Bill 1', 5]],
      sources,
      tool: 'query_tables',
      detail: null,
    });
    await useCase.execute({ session, resultId: saved.id, format: 'xlsx', exportsDir: '/exports' });

    expect(exporter.exported[0]?.table).toEqual({
      title: 'Items',
      columns: ['item_code', 'amount', 'excel_row'],
      rows: [['A1', 2000000, 5]],
      sources,
    });
    expect(session.result(saved.id)?.columns).toEqual(['item_code', 'amount', '_row', '_page', '_section', 'excel_row']);
  });

  it('passes the format through', async () => {
    const { exporter, useCase, session, saved } = setup();
    const file = await useCase.execute({ session, resultId: saved.id, format: 'csv', exportsDir: '/exports' });
    expect(file.fileName).toBe('boq-items-above-1m-20261028-140509.csv');
    expect(exporter.exported[0]?.format).toBe('csv');
  });

  it('falls back to "result" when the title has no ASCII letters or is missing', async () => {
    for (const title of ['جدول الكميات', null]) {
      const { useCase, session, saved } = setup(title);
      const file = await useCase.execute({ session, resultId: saved.id, format: 'xlsx', exportsDir: '/exports' });
      expect(file.fileName).toBe('result-20261028-140509.xlsx');
    }
  });

  it('reports an unknown result id as result_not_found', async () => {
    const { exporter, useCase, session } = setup();
    const attempt = useCase.execute({ session, resultId: 'r99', format: 'xlsx', exportsDir: '/exports' });
    await expect(attempt).rejects.toBeInstanceOf(AppError);
    await expect(attempt).rejects.toMatchObject({ code: 'result_not_found' });
    expect(exporter.exported).toHaveLength(0);
  });

  it('only sees results saved in the same chat', async () => {
    const { useCase, saved } = setup();
    const other = new Session('s2');
    await expect(
      useCase.execute({ session: other, resultId: saved.id, format: 'xlsx', exportsDir: '/exports' }),
    ).rejects.toMatchObject({ code: 'result_not_found' });
  });
});
