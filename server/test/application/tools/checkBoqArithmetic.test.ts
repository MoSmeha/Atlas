import { describe, expect, it } from 'vitest';
import { checkBoqArithmetic, type CheckBoqArithmeticOutput } from '../../../src/application/tools/checkBoqArithmetic';
import { tools } from '../../../src/application/tools/registry';
import { ToolError } from '../../../src/application/tools/Tool';
import type { CleanTable } from '../../../src/domain/table';
import { FakeIndex } from '../../fakes/FakeIndex';
import { boqTable, excelRecord, pdfRecord } from '../../fakes/records';
import { makeToolContext } from '../../fakes/toolContext';

/** Turns row `index` of a BOQ table into a total row with the given label and amount. */
function total(table: CleanTable, index: number, label: string, amount: number): CleanTable {
  const row = table.rows[index];
  if (!row) throw new Error(`no row ${index}`);
  row.values = [null, label, null, null, amount];
  row.isTotal = true;
  return table;
}

/** Rev0-like workbook: a wrong amount on Substructure row 6, a sub-total that misses row 8 on Superstructure. */
function setup() {
  const index = new FakeIndex();
  index.save(
    excelRecord('BOQ_Rev0.xlsx', [
      boqTable(
        [
          ['1.1.01', 'Excavation', 1200, 18.5, 22200],
          ['1.1.05', 'Imported selected fill', 1850, 46.5, 80625],
          ['1.1.06', 'Termite treatment', 900, 12, 10800],
        ],
        'Substructure',
      ),
      total(
        boqTable(
          [
            ['2.1.01', 'Columns concrete', 10, 1000, 10000],
            ['2.1.02', 'Slab concrete', 4, 2500, 10000],
            ['2.1.03', 'Formwork', 1, 117000, 117000],
            ['', 'Sub-total', 0, 0, 0],
          ],
          'Superstructure',
        ),
        3,
        'Sub-total 2.1 Concrete',
        20000,
      ),
    ]),
  );
  index.save(excelRecord('BOQ_Rev1.xlsx', [boqTable([['1.1.01', 'Excavation', 1200, 18.5, 22200]], 'Substructure')]));
  index.save(
    excelRecord('Ledger.xlsx', [
      {
        title: 'Payments',
        sheet: 'Ledger',
        pageFrom: null,
        pageTo: null,
        currency: 'SAR',
        columns: [
          { name: 'date', label: 'Date', type: 'text', role: null },
          { name: 'amount', label: 'Amount', type: 'number', role: 'amount' },
        ],
        rows: [{ values: ['2026-01-01', 500], sheetRow: 2, page: null, isTotal: false, section: null }],
      },
    ]),
  );
  const context = makeToolContext({ index });
  return { index, context };
}

async function run(args: { document: string | null; table: string | null }, context = setup().context) {
  const result = await checkBoqArithmetic.run(args, context);
  return { ...result, output: result.output as CheckBoqArithmeticOutput, context };
}

async function rejection(promise: Promise<unknown>): Promise<string> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(ToolError);
  return (error as ToolError).message;
}

describe('check_boq_arithmetic', () => {
  it('is registered', () => {
    expect(tools).toContain(checkBoqArithmetic);
  });

  it('finds wrong amounts and wrong sub-totals in every BOQ table and saves them with sources', async () => {
    const { output, summary, context } = await run({ document: null, table: null });
    expect(summary).toBe('2 mismatches in 3 tables (r1)');
    expect(output.result_id).toBe('r1');
    expect(output.checked_rows).toBe(8);
    expect(output.checked_tables.map(({ table, sheet, rows, mismatches }) => ({ table, sheet, rows, mismatches }))).toEqual([
      { table: 'boq_rev0_1', sheet: 'Substructure', rows: 3, mismatches: 1 },
      { table: 'boq_rev0_2', sheet: 'Superstructure', rows: 4, mismatches: 1 },
      { table: 'boq_rev1_1', sheet: 'Substructure', rows: 1, mismatches: 0 },
    ]);
    expect(output.mismatch_count).toBe(2);
    expect(output.mismatches[0]).toEqual({
      document: 'BOQ_Rev0.xlsx',
      sheet: 'Substructure',
      page: null,
      row: 6,
      item: '1.1.05',
      description: 'Imported selected fill',
      quantity: 1850,
      rate: 46.5,
      stated: 80625,
      expected: 86025,
      difference: -5400,
      currency: 'SAR',
      check: 'quantity x rate',
      covers: null,
      note: null,
    });
    expect(output.mismatches[1]).toMatchObject({
      sheet: 'Superstructure',
      row: 8,
      item: null,
      description: 'Sub-total 2.1 Concrete',
      quantity: null,
      rate: null,
      stated: 20000,
      expected: 137000,
      difference: -117000,
      check: 'total',
      covers: 'the 3 item rows from row 5 to row 7',
      note: 'Row 7 (item 2.1.03) has an amount equal to the gap; the total seems to leave it out.',
    });
    expect(output.note).toBeNull();

    const saved = context.session.result('r1');
    expect(saved?.tool).toBe('check_boq_arithmetic');
    expect(saved?.columns).toEqual([
      'document',
      'sheet',
      'row',
      'item',
      'description',
      'quantity',
      'rate',
      'stated',
      'expected',
      'difference',
      'currency',
    ]);
    expect(saved?.rows).toEqual([
      ['BOQ_Rev0.xlsx', 'Substructure', 6, '1.1.05', 'Imported selected fill', 1850, 46.5, 80625, 86025, -5400, 'SAR'],
      ['BOQ_Rev0.xlsx', 'Superstructure', 8, null, 'Sub-total 2.1 Concrete', null, null, 20000, 137000, -117000, 'SAR'],
    ]);
    expect(saved?.sources).toEqual([
      { kind: 'excel', document: 'BOQ_Rev0.xlsx', sheet: 'Substructure', rowFrom: 6, rowTo: 6 },
      { kind: 'excel', document: 'BOQ_Rev0.xlsx', sheet: 'Superstructure', rowFrom: 5, rowTo: 8 },
    ]);
    expect(context.session.evidence.has(86025)).toBe(true);
  });

  it('checks only the tables of one document', async () => {
    const { output, summary } = await run({ document: 'BOQ_Rev1', table: null });
    expect(output.checked_tables.map((table) => table.table)).toEqual(['boq_rev1_1']);
    expect(summary).toBe('No mismatches in 1 table (r1)');
  });

  it('checks one table by name, ignoring case', async () => {
    const { output } = await run({ document: null, table: 'BOQ_REV0_2' });
    expect(output.checked_tables.map((table) => table.table)).toEqual(['boq_rev0_2']);
    expect(output.mismatches.map((mismatch) => mismatch.row)).toEqual([8]);
  });

  it('saves an empty result citing the whole table when everything adds up', async () => {
    const { output, context } = await run({ document: 'BOQ_Rev1.xlsx', table: 'boq_rev1_1' });
    expect(output.mismatches).toEqual([]);
    expect(output.note).toBe('Every checked row adds up: quantity x rate matches each amount and every total matches its rows.');
    expect(context.session.result(output.result_id)).toMatchObject({
      rows: [],
      sources: [{ kind: 'excel', document: 'BOQ_Rev1.xlsx', sheet: 'Substructure', rowFrom: 5, rowTo: 5 }],
    });
  });

  it('lists the first 30 mismatches and keeps them all in the result', async () => {
    const index = new FakeIndex();
    const rows = Array.from({ length: 35 }, (_, i): [string, string, number, number, number] => [`X${i + 1}`, 'Wrong', 2, 10, 21]);
    index.save(excelRecord('Big.xlsx', [boqTable(rows)]));
    const { output, summary, context } = await run({ document: null, table: null }, makeToolContext({ index }));
    expect(summary).toBe('35 mismatches in 1 table (r1)');
    expect(output.mismatches).toHaveLength(30);
    expect(output.mismatch_count).toBe(35);
    expect(output.note).toBe('Showing the first 30 of 35 mismatches; all of them are saved in r1.');
    expect(context.session.result('r1')?.rows).toHaveLength(35);
  });

  it('lists fewer mismatches when many tables were checked, so the output is never cut', async () => {
    const index = new FakeIndex();
    const long = 'Reinforced concrete grade C40 to suspended slabs including formwork and curing '.repeat(3);
    for (let i = 1; i <= 60; i++) {
      index.save(excelRecord(`Bills/Package_${i}_BOQ.xlsx`, [boqTable([[`${i}.1`, long, 2, 10, 21]], `Bill ${i}`)]));
    }
    const { output } = await run({ document: null, table: null }, makeToolContext({ index }));
    expect(JSON.stringify(output).length).toBeLessThanOrEqual(18_000);
    expect(output.checked_tables).toHaveLength(60);
    expect(output.mismatches.length).toBeLessThan(30);
    expect(output.note).toBe(`Showing the first ${output.mismatches.length} of 60 mismatches; all of them are saved in r1.`);
  });

  it('cites pages for PDF tables, with a page column and the item code as quote', async () => {
    const index = new FakeIndex();
    const record = pdfRecord('Tender_BOQ.pdf', ['Cover', 'Notes', 'Bill page 1', 'Bill page 2']);
    const table: CleanTable = {
      ...boqTable([]),
      sheet: null,
      pageFrom: 3,
      pageTo: 4,
      currency: null,
      columns: [...boqTable([]).columns, { name: 'currency', label: 'Cur', type: 'text', role: 'currency' }],
      rows: [
        { values: ['A1', 'Pipes', 10, 15, 150, 'USD'], sheetRow: null, page: 3, isTotal: false, section: null },
        { values: ['A2', 'Valves', 2, 40, 90, 'USD'], sheetRow: null, page: 4, isTotal: false, section: null },
        { values: [null, 'Total', null, null, 230, 'USD'], sheetRow: null, page: 4, isTotal: true, section: null },
      ],
    };
    index.save({ ...record, tables: [table] });
    const { output, context } = await run({ document: 'Tender_BOQ.pdf', table: null }, makeToolContext({ index }));
    expect(output.checked_tables[0]?.pages).toEqual({ from: 3, to: 4 });
    const brief = output.mismatches.map(({ page, row, item, expected, currency, covers }) => ({ page, row, item, expected, currency, covers }));
    expect(brief).toEqual([
      { page: 4, row: null, item: 'A2', expected: 80, currency: 'USD', covers: null },
      { page: 4, row: null, item: null, expected: 240, currency: 'USD', covers: 'the 2 item rows on pages 3 and 4' },
    ]);
    const saved = context.session.result(output.result_id);
    expect(saved?.columns).toEqual([
      'document',
      'sheet',
      'row',
      'page',
      'item',
      'description',
      'quantity',
      'rate',
      'stated',
      'expected',
      'difference',
      'currency',
    ]);
    expect(saved?.sources).toEqual([
      { kind: 'pdf', document: 'Tender_BOQ.pdf', page: 4, quote: 'A2' },
      { kind: 'pdf', document: 'Tender_BOQ.pdf', page: 3, quote: null },
      { kind: 'pdf', document: 'Tender_BOQ.pdf', page: 4, quote: null },
    ]);
  });

  it('cuts long descriptions for the model but keeps them whole in the result', async () => {
    const index = new FakeIndex();
    const long = 'Supply and install '.repeat(20).trim();
    index.save(excelRecord('Long.xlsx', [boqTable([['L1', long, 1, 10, 11]])]));
    const { output, context } = await run({ document: null, table: null }, makeToolContext({ index }));
    const shown = output.mismatches[0]?.description ?? '';
    expect(shown.length).toBeLessThanOrEqual(160);
    expect(shown.endsWith('install Supply…')).toBe(true);
    expect(context.session.result('r1')?.rows[0]?.[4]).toBe(long);
  });

  it('explains when no loaded table has quantity, rate and amount columns', async () => {
    const index = new FakeIndex();
    index.save(pdfRecord('Contract.pdf', ['Clause 1']));
    const message = await rejection(run({ document: null, table: null }, makeToolContext({ index })));
    expect(message).toMatch(/^No loaded document has a table with quantity, rate and amount columns/);
    expect(message).toContain('do not check amounts from page text');
  });

  it('explains when a document has no BOQ table, and names the ones that do', async () => {
    const message = await rejection(run({ document: 'Ledger.xlsx', table: null }));
    expect(message).toBe(
      'Ledger.xlsx has no table with quantity, rate and amount columns, so there is no BOQ arithmetic to check in it. ' +
        'Tables with quantity, rate and amount columns: boq_rev0_1 (BOQ_Rev0.xlsx), boq_rev0_2 (BOQ_Rev0.xlsx), ' +
        'boq_rev1_1 (BOQ_Rev1.xlsx).',
    );
  });

  it('says why an unreadable document has nothing to check', async () => {
    const { index, context } = setup();
    index.save({ ...pdfRecord('Locked.pdf', []), status: 'encrypted', statusDetail: 'The PDF is password protected.' });
    const message = await rejection(run({ document: 'Locked.pdf', table: null }, context));
    expect(message).toMatch(/^Locked\.pdf could not be read \(The PDF is password protected\.\), so it has no tables to check\./);
  });

  it('rejects an unknown document, an unknown table, a table without BOQ columns and a table from another document', async () => {
    expect(await rejection(run({ document: 'Missing.xlsx', table: null }))).toMatch(/^No loaded document matches "Missing.xlsx"/);
    expect(await rejection(run({ document: null, table: 'nope' }))).toMatch(
      /^No loaded table is called "nope"\. Tables with quantity, rate and amount columns: boq_rev0_1/,
    );
    expect(await rejection(run({ document: null, table: 'ledger_1' }))).toMatch(
      /^ledger_1 has no quantity, rate and amount columns, so its arithmetic cannot be checked\./,
    );
    expect(await rejection(run({ document: 'BOQ_Rev1.xlsx', table: 'boq_rev0_1' }))).toBe(
      'boq_rev0_1 comes from BOQ_Rev0.xlsx, not BOQ_Rev1.xlsx. Give its document, or null for document.',
    );
  });
});
