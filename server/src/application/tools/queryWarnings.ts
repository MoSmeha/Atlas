import type { SqlReferences } from '../../domain/sqlReferences';
import { META_COLUMNS } from '../../domain/table';
import type { TableRowRecord, TableSchema } from '../ports/DocumentIndex';

/** Functions that add amounts up, so they must not mix currencies. */
const ADDING = new Set(['sum', 'total', 'avg']);

/**
 * Warnings for a query that ran but may break an answer rule: it reads total rows without filtering
 * _is_total, or it adds up amounts in more than one currency without separating them by currency.
 */
export function queryWarnings(
  references: SqlReferences,
  tables: readonly TableSchema[],
  rowsOf: (table: string) => TableRowRecord[],
): string[] {
  const warnings: string[] = [];
  const names = new Set(references.names);

  if (!names.has(META_COLUMNS.isTotal)) {
    const withTotals = tables
      .map((table) => ({ table, count: rowsOf(table.name).filter((row) => row.isTotal).length }))
      .filter(({ count }) => count > 0);
    if (withTotals.length > 0) {
      const list = withTotals.map(({ table, count }) => `${table.name} has ${count} total ${count === 1 ? 'row' : 'rows'}`);
      warnings.push(
        `${joinWords(list)} (${META_COLUMNS.isTotal} = 1) that this query does not leave out. ` +
          `If it sums, counts or lists items, run it again with WHERE ${META_COLUMNS.isTotal} = 0.`,
      );
    }
  }

  if (references.calls.some((call) => ADDING.has(call)) && !names.has('currency')) {
    for (const table of tables) {
      const currencies = rowCurrencies(rowsOf(table.name));
      if (currencies.length > 1) {
        warnings.push(
          `${table.name} holds amounts in ${joinWords(currencies)}; never add them together: ` +
            'GROUP BY currency and give one total per currency.',
        );
      }
    }
    const stated = tables.filter((table) => table.currency !== null);
    if (new Set(stated.map((table) => table.currency)).size > 1) {
      const list = stated.map((table) => `${table.name} in ${table.currency}`);
      warnings.push(`These tables are in different currencies (${list.join(', ')}); total each currency on its own, never together.`);
    }
  }
  return warnings;
}

/** Distinct values of the currency column over the item rows, sorted. */
function rowCurrencies(rows: TableRowRecord[]): string[] {
  const values = rows
    .filter((row) => !row.isTotal)
    .map((row) => row.values.currency)
    .filter((value): value is string => typeof value === 'string' && value.trim() !== '');
  return [...new Set(values.map((value) => value.trim()))].sort();
}

function joinWords(words: string[]): string {
  return words.length <= 1 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
}
