import { describe, expect, it } from 'vitest';
import type { DocumentRecord } from '../../../src/application/ports/DocumentIndex';
import { compareRevisions, type CompareRevisionsOutput } from '../../../src/application/tools/compareRevisions';
import { tools } from '../../../src/application/tools/registry';
import { ToolError, type ToolContext } from '../../../src/application/tools/Tool';
import type { CleanTable } from '../../../src/domain/table';
import { FakeIndex } from '../../fakes/FakeIndex';
import { boqTable, excelRecord, pdfRecord } from '../../fakes/records';
import { makeToolContext } from '../../fakes/toolContext';

type Item = [string, string, number, number, number];

/** A BOQ table on a sheet, item rows from row 5, closed by a sub-total row whose amount is deliberately wrong. */
function bill(sheet: string, items: Item[], subtotal: number | null = null): CleanTable {
  const table = boqTable(items, sheet);
  if (subtotal !== null) {
    table.rows.push({ values: [null, `Sub-total ${sheet}`, null, null, subtotal], sheetRow: 5 + items.length, page: null, isTotal: true, section: null });
  }
  return table;
}

/** Rev0 and Rev1 of one BOQ: one quantity change, one rate change on an item that lost its code, one added, one removed. */
function setup() {
  const index = new FakeIndex();
  index.save(
    excelRecord('BOQ_Rev0.xlsx', [
      bill(
        'Substructure',
        [
          ['1.1.01', 'Site clearance and removal of debris', 1, 85000, 85000],
          ['1.1.02', 'Bulk excavation in rock-like ground, including disposal off Site', 96000, 42, 4032000],
          ['1.2.06', 'Pile load tests, static, to 2.5 times working load', 3, 39000, 117000],
        ],
        999,
      ),
      bill('MEP', [
        ['3.4.01', 'Testing and commissioning of all MEP systems', 1, 950000, 950000],
        ['3.4.02', 'Independent commissioning agent', 1, 380000, 380000],
      ]),
    ]),
  );
  index.save(
    excelRecord('BOQ_Rev1.xlsx', [
      bill(
        'Substructure',
        [
          ['1-1-01', 'Site clearance and removal of debris', 1, 85000, 85000],
          ['1.1.02', 'Bulk excavation in rock-like ground, including disposal off Site', 101500, 42, 4263000],
          ['', 'Pile load tests, static, to 2.5 times the working load', 3, 41000, 123000],
        ],
        111,
      ),
      bill('MEP', [
        ['3.2.07', 'Electric vehicle charging points, 22 kW', 40, 14500, 580000],
        ['3.4.01', 'Testing and commissioning of all MEP systems', 1, 950000, 950000],
      ]),
    ]),
  );
  return { index, context: makeToolContext({ index }) };
}

async function run(document_a: string, document_b: string, context: ToolContext = setup().context) {
  const result = await compareRevisions.run({ document_a, document_b }, context);
  return { ...result, output: result.output as CompareRevisionsOutput, context };
}

async function rejection(promise: Promise<unknown>): Promise<string> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(ToolError);
  return (error as ToolError).message;
}

function withIndex(...records: DocumentRecord[]): ToolContext {
  const index = new FakeIndex();
  for (const record of records) index.save(record);
  return makeToolContext({ index });
}

describe('compare_revisions', () => {
  it('is registered', () => {
    expect(tools).toContain(compareRevisions);
  });

  it('reports added, removed and changed items with per-currency totals', async () => {
    const { output, summary } = await run('BOQ_Rev0.xlsx', 'BOQ_Rev1');
    expect(summary).toBe('1 added, 1 removed, 2 changed');
    expect(output).toMatchObject({
      result_id: 'r1',
      document_a: 'BOQ_Rev0.xlsx',
      document_b: 'BOQ_Rev1.xlsx',
      tables_a: ['boq_rev0_1', 'boq_rev0_2'],
      tables_b: ['boq_rev1_1', 'boq_rev1_2'],
      items_a: 5,
      items_b: 5,
      added: 1,
      removed: 1,
      changed: 2,
      unchanged: 2,
      matched_by_description: 1,
      total_a_by_currency: { SAR: 5564000 },
      total_b_by_currency: { SAR: 6001000 },
      total_delta_by_currency: { SAR: 437000 },
    });
    expect(output.differences.map((difference) => [difference.change, difference.item, difference.delta])).toEqual([
      ['added', '3.2.07', 580000],
      ['removed', '3.4.02', -380000],
      ['changed', '1.1.02', 231000],
      ['changed', '1.2.06', 6000],
    ]);
    expect(output.differences[2]).toEqual({
      change: 'changed',
      sheet: 'Substructure',
      item: '1.1.02',
      description: 'Bulk excavation in rock-like ground, including disposal off Site',
      changed_fields: ['quantity', 'amount'],
      matched_by: 'code',
      qty_a: 96000,
      qty_b: 101500,
      rate_a: 42,
      rate_b: 42,
      amount_a: 4032000,
      amount_b: 4263000,
      delta: 231000,
      currency: 'SAR',
      row_a: 6,
      row_b: 6,
      page_a: null,
      page_b: null,
    });
    expect(output.note).toBe('1 item was matched by description because the item codes were missing or different; matched_by shows which.');
  });

  it('matches an item with no code by its description', async () => {
    const { output } = await run('BOQ_Rev0.xlsx', 'BOQ_Rev1.xlsx');
    expect(output.differences[3]).toMatchObject({
      item: '1.2.06',
      description: 'Pile load tests, static, to 2.5 times the working load',
      changed_fields: ['rate', 'amount'],
      matched_by: 'description',
      rate_a: 39000,
      rate_b: 41000,
      delta: 6000,
    });
  });

  it('leaves totals and sub-totals out of the items and the totals', async () => {
    const { output } = await run('BOQ_Rev0.xlsx', 'BOQ_Rev1.xlsx');
    expect(output.items_a).toBe(5);
    expect(output.differences.some((difference) => difference.description?.startsWith('Sub-total'))).toBe(false);
    expect(output.total_delta_by_currency).toEqual({ SAR: 437000 });
  });

  it('saves every difference with the specified columns and sources in both documents', async () => {
    const { output, context } = await run('BOQ_Rev0.xlsx', 'BOQ_Rev1.xlsx');
    const saved = context.session.result(output.result_id);
    expect(saved?.tool).toBe('compare_revisions');
    expect(saved?.title).toBe('BOQ changes from BOQ_Rev0.xlsx to BOQ_Rev1.xlsx');
    expect(saved?.columns).toEqual([
      'change',
      'sheet',
      'item',
      'description',
      'qty_a',
      'qty_b',
      'rate_a',
      'rate_b',
      'amount_a',
      'amount_b',
      'delta',
      'currency',
    ]);
    expect(saved?.rows).toEqual([
      ['added', 'MEP', '3.2.07', 'Electric vehicle charging points, 22 kW', null, 40, null, 14500, null, 580000, 580000, 'SAR'],
      ['removed', 'MEP', '3.4.02', 'Independent commissioning agent', 1, null, 380000, null, 380000, null, -380000, 'SAR'],
      [
        'changed',
        'Substructure',
        '1.1.02',
        'Bulk excavation in rock-like ground, including disposal off Site',
        96000,
        101500,
        42,
        42,
        4032000,
        4263000,
        231000,
        'SAR',
      ],
      [
        'changed',
        'Substructure',
        '1.2.06',
        'Pile load tests, static, to 2.5 times the working load',
        3,
        3,
        39000,
        41000,
        117000,
        123000,
        6000,
        'SAR',
      ],
    ]);
    expect(saved?.sources).toEqual([
      { kind: 'excel', document: 'BOQ_Rev0.xlsx', sheet: 'Substructure', rowFrom: 6, rowTo: 7 },
      { kind: 'excel', document: 'BOQ_Rev0.xlsx', sheet: 'MEP', rowFrom: 6, rowTo: 6 },
      { kind: 'excel', document: 'BOQ_Rev1.xlsx', sheet: 'Substructure', rowFrom: 6, rowTo: 7 },
      { kind: 'excel', document: 'BOQ_Rev1.xlsx', sheet: 'MEP', rowFrom: 5, rowTo: 5 },
    ]);
  });

  it('notes the totals as evidence so calculate may use them', async () => {
    const { context } = await run('BOQ_Rev0.xlsx', 'BOQ_Rev1.xlsx');
    expect(context.session.evidence.has(5564000)).toBe(true);
    expect(context.session.evidence.has(6001000)).toBe(true);
    expect(context.session.evidence.has(437000)).toBe(true);
  });

  it('keeps items of different sheets apart even with the same code', async () => {
    const context = withIndex(
      excelRecord('A.xlsx', [bill('Bill 1', [['A1', 'Excavation', 10, 5, 50]]), bill('Bill 2', [['A1', 'Columns', 4, 1000, 4000]])]),
      excelRecord('B.xlsx', [bill('Bill 2', [['A1', 'Columns', 4, 1000, 4000]]), bill('Bill 1', [['A1', 'Excavation', 12, 5, 60]])]),
    );
    const { output } = await run('A.xlsx', 'B.xlsx', context);
    expect(output).toMatchObject({ added: 0, removed: 0, changed: 1, unchanged: 1 });
    expect(output.differences[0]).toMatchObject({ sheet: 'Bill 1', item: 'A1', qty_a: 10, qty_b: 12, delta: 10 });
  });

  it('sums the total change per currency and never across currencies', async () => {
    const priced = (rows: [string, string, number, number, number, string][]): CleanTable => ({
      ...boqTable([]),
      sheet: 'Imported',
      currency: null,
      columns: [...boqTable([]).columns, { name: 'currency', label: 'Currency', type: 'text', role: 'currency' }],
      rows: rows.map((values, i) => ({ values, sheetRow: 5 + i, page: null, isTotal: false, section: null })),
    });
    const context = withIndex(
      excelRecord('Rev0.xlsx', [
        priced([
          ['1', 'Chillers', 2, 100000, 200000, 'USD'],
          ['2', 'Local works', 1, 50000, 50000, 'SAR'],
        ]),
      ]),
      excelRecord('Rev1.xlsx', [
        priced([
          ['1', 'Chillers', 2, 110000, 220000, 'US$'],
          ['2', 'Local works', 1, 52000, 52000, 'SR'],
        ]),
      ]),
    );
    const { output, context: used } = await run('Rev0.xlsx', 'Rev1.xlsx', context);
    expect(output.total_delta_by_currency).toEqual({ USD: 20000, SAR: 2000 });
    expect(output.differences.map((difference) => [difference.item, difference.delta, difference.currency])).toEqual([
      ['1', 20000, 'USD'],
      ['2', 2000, 'SAR'],
    ]);
    expect(output.note).toBe('Amounts are in more than one currency: give each currency its own total and never add them.');
    expect(used.session.result(output.result_id)?.rows.map((row) => row.at(-1))).toEqual(['USD', 'SAR']);
  });

  it('labels a currency change and gives no amount delta across it', async () => {
    const context = withIndex(
      excelRecord('Rev0.xlsx', [{ ...boqTable([['1', 'Chillers', 2, 375000, 750000]]), currency: 'SAR' }]),
      excelRecord('Rev1.xlsx', [{ ...boqTable([['1', 'Chillers', 2, 100000, 200000]]), currency: 'USD' }]),
    );
    const { output } = await run('Rev0.xlsx', 'Rev1.xlsx', context);
    expect(output.differences[0]).toMatchObject({
      changed_fields: ['rate', 'amount', 'currency'],
      delta: null,
      currency: 'SAR -> USD',
    });
    expect(output.total_delta_by_currency).toEqual({ SAR: -750000, USD: 200000 });
  });

  it('shows a renumbered item with both codes', async () => {
    const context = withIndex(
      excelRecord('Rev0.xlsx', [boqTable([['2.3.06', 'Bird deterrent mesh and spikes to facade ledges', 1150, 60, 69000]])]),
      excelRecord('Rev1.xlsx', [boqTable([['2.3.07', 'Bird deterrent mesh and spikes to the facade ledges', 1150, 64, 73600]])]),
    );
    const { output } = await run('Rev0.xlsx', 'Rev1.xlsx', context);
    expect(output.differences[0]).toMatchObject({ change: 'changed', item: '2.3.07 (was 2.3.06)', matched_by: 'description' });
  });

  it('cites PDF pages with the item code', async () => {
    const pdfBoq = (items: [string, string, number, number, number, number][]): CleanTable => ({
      ...boqTable([]),
      sheet: null,
      pageFrom: 4,
      pageTo: 5,
      rows: items.map(([code, text, quantity, rate, amount, page]) => ({
        values: [code, text, quantity, rate, amount],
        sheetRow: null,
        page,
        isTotal: false,
        section: null,
      })),
    });
    const context = withIndex(
      { ...pdfRecord('Tender_BOQ_A.pdf', ['', '', '', 'a', 'b']), tables: [pdfBoq([['A', 'Excavation', 10, 5, 50, 4], ['B', 'Fill', 2, 3, 6, 5]])] },
      { ...pdfRecord('Tender_BOQ_B.pdf', ['', '', '', 'a', 'b']), tables: [pdfBoq([['A', 'Excavation', 10, 5, 50, 4], ['B', 'Fill', 4, 3, 12, 5]])] },
    );
    const { output, context: used } = await run('Tender_BOQ_A.pdf', 'Tender_BOQ_B.pdf', context);
    expect(output.differences[0]).toMatchObject({ item: 'B', sheet: null, row_a: null, page_a: 5, page_b: 5 });
    expect(used.session.result(output.result_id)?.sources).toEqual([
      { kind: 'pdf', document: 'Tender_BOQ_A.pdf', page: 5, quote: 'B' },
      { kind: 'pdf', document: 'Tender_BOQ_B.pdf', page: 5, quote: 'B' },
    ]);
  });

  it('cites both whole tables when nothing changed', async () => {
    const items: Item[] = [
      ['1', 'Excavation', 10, 5, 50],
      ['2', 'Fill', 2, 3, 6],
    ];
    const context = withIndex(excelRecord('Rev0.xlsx', [boqTable(items)]), excelRecord('Rev1.xlsx', [boqTable(items)]));
    const { output, summary, context: used } = await run('Rev0.xlsx', 'Rev1.xlsx', context);
    expect(summary).toBe('0 added, 0 removed, 0 changed');
    expect(output).toMatchObject({ unchanged: 2, differences: [], total_delta_by_currency: { SAR: 0 } });
    expect(output.note).toBe('Every item matches: the same quantity, rate and amount in both documents.');
    expect(used.session.result('r1')).toMatchObject({
      rows: [],
      sources: [
        { kind: 'excel', document: 'Rev0.xlsx', sheet: 'Bill 1', rowFrom: 5, rowTo: 6 },
        { kind: 'excel', document: 'Rev1.xlsx', sheet: 'Bill 1', rowFrom: 5, rowTo: 6 },
      ],
    });
  });

  it('lists the 30 largest differences and keeps them all in the result', async () => {
    const rows = (rate: (i: number) => number) =>
      Array.from({ length: 40 }, (_, i): Item => [`X${i + 1}`, `Item ${i + 1}`, 1, rate(i), rate(i)]);
    const context = withIndex(
      excelRecord('Rev0.xlsx', [boqTable(rows(() => 100))]),
      excelRecord('Rev1.xlsx', [boqTable(rows((i) => 100 + i + 1))]),
    );
    const { output, summary, context: used } = await run('Rev0.xlsx', 'Rev1.xlsx', context);
    expect(summary).toBe('0 added, 0 removed, 40 changed');
    expect(output.differences).toHaveLength(30);
    expect(output.differences[0]?.item).toBe('X11');
    expect(output.differences.at(-1)?.item).toBe('X40');
    expect(output.note).toBe('Showing the 30 largest of 40 differences by amount; all of them are saved in r1.');
    expect(used.session.result('r1')?.rows).toHaveLength(40);
  });

  it('cuts long descriptions in the output and keeps them whole in the result', async () => {
    const long = 'Reinforced concrete grade C40 to suspended slabs including formwork, curing and protection '.repeat(2);
    const context = withIndex(
      excelRecord('Rev0.xlsx', [boqTable([['1', long, 1, 10, 10]])]),
      excelRecord('Rev1.xlsx', [boqTable([['1', long, 2, 10, 20]])]),
    );
    const { output, context: used } = await run('Rev0.xlsx', 'Rev1.xlsx', context);
    expect(output.differences[0]?.description).toHaveLength(120);
    expect(output.differences[0]?.description?.endsWith('…')).toBe(true);
    expect(used.session.result('r1')?.rows[0]?.[3]).toBe(long.trim());
  });

  it('lists fewer differences when entries are very long, so the output is never cut', async () => {
    const code = (i: number) => `${'PROVISIONAL SUM FOR ADDITIONAL WORKS '.repeat(12)}${i}`;
    const rows = (quantity: number) => Array.from({ length: 30 }, (_, i): Item => [code(i + 1), `Item ${i + 1}`, quantity, 10, quantity * 10]);
    const context = withIndex(excelRecord('Rev0.xlsx', [boqTable(rows(1))]), excelRecord('Rev1.xlsx', [boqTable(rows(2))]));
    const { output } = await run('Rev0.xlsx', 'Rev1.xlsx', context);
    expect(JSON.stringify(output).length).toBeLessThanOrEqual(18_000);
    expect(output.differences.length).toBeLessThan(30);
    expect(output.differences.length).toBeGreaterThanOrEqual(5);
    expect(output.note).toBe(`Showing the ${output.differences.length} largest of 30 differences by amount; all of them are saved in r1.`);
  });

  it('asks for a loaded document when a name is unknown', async () => {
    const message = await rejection(run('BOQ_Rev9.xlsx', 'BOQ_Rev1.xlsx'));
    expect(message).toContain('No loaded document matches "BOQ_Rev9.xlsx"');
    expect(message).toContain('BOQ_Rev0.xlsx');
  });

  it('refuses to compare a document with itself', async () => {
    const message = await rejection(run('BOQ_Rev0', 'boq_rev0.xlsx'));
    expect(message).toBe('document_a and document_b are both BOQ_Rev0.xlsx. Give two different revisions of the BOQ.');
  });

  it('says when a document has no priced BOQ table', async () => {
    const { index, context } = setup();
    const ledger = excelRecord('Ledger.xlsx', [{ ...boqTable([]), columns: boqTable([]).columns.filter((c) => c.name !== 'rate') }]);
    index.save(ledger);
    const message = await rejection(run('Ledger.xlsx', 'BOQ_Rev1.xlsx', context));
    expect(message).toBe(
      'Ledger.xlsx has no table with quantity, rate and amount columns, so it has no priced items to compare. ' +
        'Say that this document has no priced bill of quantities; do not compare page text.',
    );
  });

  it('says when a document could not be read', async () => {
    const { index, context } = setup();
    index.save({ ...excelRecord('BOQ_Rev2.xlsx', []), status: 'corrupt', statusDetail: 'the file is damaged' });
    const message = await rejection(run('BOQ_Rev1.xlsx', 'BOQ_Rev2.xlsx', context));
    expect(message).toContain('BOQ_Rev2.xlsx could not be read (the file is damaged), so it has no tables to compare.');
  });
});
