import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Session } from '../../../src/application/session/Session';
import { exportTable } from '../../../src/application/tools/exportTable';
import { tools } from '../../../src/application/tools/registry';
import { ToolError } from '../../../src/application/tools/Tool';
import { FakeClock } from '../../fakes/FakeClock';
import { FakeExporter } from '../../fakes/FakeOutputs';
import { makeToolContext } from '../../fakes/toolContext';

function setup() {
  const session = new Session('s1');
  const saved = session.saveResult({
    title: 'BOQ items above 1M',
    columns: ['item_code', 'amount'],
    rows: [['A1', 2000000]],
    sources: [{ kind: 'excel', document: 'BOQ.xlsx', sheet: 'Bill 1', rowFrom: 5, rowTo: 5 }],
    tool: 'query_tables',
    detail: null,
  });
  const exporter = new FakeExporter();
  const context = makeToolContext({ session, exporter, clock: new FakeClock('2026-10-28T14:05:09') });
  return { saved, exporter, context };
}

describe('export_table', () => {
  it('exports a saved result and reports the file', async () => {
    const { saved, exporter, context } = setup();
    const result = await exportTable.run({ result_id: saved.id, format: 'xlsx' }, context);

    expect(result.output).toEqual({
      file: 'boq-items-above-1m-20261028-140509.xlsx',
      path: '/exports/boq-items-above-1m-20261028-140509.xlsx',
    });
    expect(result.summary).toBe('Exported r1 to exports/boq-items-above-1m-20261028-140509.xlsx');
    expect(exporter.exported[0]?.table.rows).toEqual([['A1', 2000000]]);
  });

  it('exports CSV when asked', async () => {
    const { saved, exporter, context } = setup();
    const result = await exportTable.run({ result_id: saved.id, format: 'csv' }, context);
    expect(result.summary).toMatch(/\.csv$/);
    expect(exporter.exported[0]?.format).toBe('csv');
  });

  it('tells the model when the result id is unknown', async () => {
    const { context } = setup();
    const attempt = exportTable.run({ result_id: 'r42', format: 'xlsx' }, context);
    await expect(attempt).rejects.toBeInstanceOf(ToolError);
    await expect(attempt).rejects.toThrow(/No saved result with id r42/);
  });

  it('accepts only xlsx or csv, and requires both fields', () => {
    expect(exportTable.parameters.safeParse({ result_id: 'r1', format: 'xlsx' }).success).toBe(true);
    expect(exportTable.parameters.safeParse({ result_id: 'r1', format: 'pdf' }).success).toBe(false);
    expect(exportTable.parameters.safeParse({ result_id: 'r1' }).success).toBe(false);
    expect(z.toJSONSchema(exportTable.parameters)).toMatchObject({ required: ['result_id', 'format'] });
  });

  it('is registered for the model', () => {
    expect(tools.filter((tool) => tool.name === 'export_table')).toHaveLength(1);
  });
});
