import { describe, expect, it } from 'vitest';
import type { TableRowRecord, TableSchema } from '../../../src/application/ports/DocumentIndex';
import { queryWarnings } from '../../../src/application/tools/queryWarnings';
import { sqlReferences } from '../../../src/domain/sqlReferences';

function schema(name: string, currency: string | null): TableSchema {
  return { name, document: 'BOQ.xlsx', title: null, sheet: name, pageFrom: null, pageTo: null, columns: [], rowCount: 3, currency };
}

function row(currency: string | null, isTotal = false): TableRowRecord {
  return { values: { amount: 100, currency }, sheetRow: 5, page: null, isTotal, section: null };
}

const tableRows: Record<string, TableRowRecord[]> = {
  t_bill_1: [row(null), row(null), row(null, true)],
  t_bill_2: [row(null), row(null)],
  t_mixed: [row('SAR'), row('USD'), row('SAR'), row('EUR', true)],
};
const rowsOf = (table: string) => tableRows[table] ?? [];

function warnings(sql: string, tables: TableSchema[]): string[] {
  return queryWarnings(sqlReferences(sql), tables, rowsOf);
}

describe('queryWarnings', () => {
  it('warns when a query reads total rows without filtering _is_total', () => {
    expect(warnings('SELECT sum(amount) FROM t_bill_1', [schema('t_bill_1', 'SAR')])).toEqual([
      't_bill_1 has 1 total row (_is_total = 1) that this query does not leave out. ' +
        'If it sums, counts or lists items, run it again with WHERE _is_total = 0.',
    ]);
  });

  it('names every table with total rows in one warning', () => {
    const tables = [schema('t_bill_1', 'SAR'), schema('t_mixed', null)];
    expect(warnings('SELECT amount FROM t_bill_1 UNION ALL SELECT amount FROM t_mixed', tables)[0]).toMatch(
      /^t_bill_1 has 1 total row and t_mixed has 1 total row \(_is_total = 1\) that this query/,
    );
  });

  it('stays quiet once the query mentions _is_total, or when no table has total rows', () => {
    expect(warnings('SELECT sum(amount) FROM t_bill_1 WHERE _is_total = 0', [schema('t_bill_1', 'SAR')])).toEqual([]);
    expect(warnings('SELECT * FROM t_bill_1 WHERE _IS_TOTAL = 1', [schema('t_bill_1', 'SAR')])).toEqual([]);
    expect(warnings('SELECT sum(amount) FROM t_bill_2', [schema('t_bill_2', 'SAR')])).toEqual([]);
  });

  it('warns when a sum adds up a currency column holding several currencies', () => {
    expect(warnings('SELECT SUM(amount) FROM t_mixed WHERE _is_total = 0', [schema('t_mixed', null)])).toEqual([
      't_mixed holds amounts in SAR and USD; never add them together: GROUP BY currency and give one total per currency.',
    ]);
    expect(warnings('SELECT currency, sum(amount) FROM t_mixed WHERE _is_total = 0 GROUP BY currency', [schema('t_mixed', null)])).toEqual(
      [],
    );
    expect(warnings('SELECT amount FROM t_mixed WHERE _is_total = 0', [schema('t_mixed', null)])).toEqual([]);
  });

  it('warns when a sum spans tables in different currencies', () => {
    const sql = 'SELECT total(amount) FROM (SELECT amount FROM t_bill_2 UNION ALL SELECT amount FROM t_usd)';
    expect(warnings(sql, [schema('t_bill_2', 'SAR'), schema('t_usd', 'USD')])).toEqual([
      'These tables are in different currencies (t_bill_2 in SAR, t_usd in USD); total each currency on its own, never together.',
    ]);
    expect(warnings(sql, [schema('t_bill_2', 'SAR'), schema('t_usd', 'SAR')])).toEqual([]);
  });
});
