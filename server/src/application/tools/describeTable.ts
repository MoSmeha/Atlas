import type { ColumnType } from '@atlas/shared';
import { describePages } from '../../domain/pageRanges';
import { META_COLUMNS } from '../../domain/table';
import type { TableSchema } from '../ports/DocumentIndex';

const SQL_TYPES: Record<ColumnType, string> = { text: 'TEXT', number: 'REAL', integer: 'INTEGER' };

/** The columns every loaded table carries after its own. */
const META_DESCRIPTION = [
  `${META_COLUMNS.sheetRow} INTEGER (Excel row)`,
  `${META_COLUMNS.page} INTEGER (PDF page)`,
  `${META_COLUMNS.isTotal} INTEGER (1 = total row; exclude from sums)`,
  `${META_COLUMNS.section} TEXT (section heading)`,
].join(', ');

/**
 * One line telling the model what a table holds and how to query it, for example
 * "Table t_boq_bill_2 - BOQ.xlsx, sheet 'Bill 2', 48 rows, currency SAR. Columns: item_code TEXT (Item), ...".
 * Sheet names, titles and labels are document text, so they are kept short and on one line.
 */
export function describeTable(table: TableSchema): string {
  const title = table.title === null ? '' : oneLine(table.title, 80);
  const parts = [
    table.document,
    location(table),
    title !== '' && title !== oneLine(table.sheet ?? '', 80) ? `title '${title}'` : null,
    `${table.rowCount} ${table.rowCount === 1 ? 'row' : 'rows'}`,
    currency(table),
  ].filter((part) => part !== null);
  const columns = table.columns.map((column) => {
    const label = oneLine(column.label, 60);
    return `${column.name} ${SQL_TYPES[column.type]}${label === '' ? '' : ` (${label})`}`;
  });
  return `Table ${table.name} - ${parts.join(', ')}. Columns: ${[...columns, META_DESCRIPTION].join(', ')}`;
}

function location(table: TableSchema): string | null {
  if (table.sheet !== null) return `sheet '${oneLine(table.sheet, 60)}'`;
  const from = table.pageFrom;
  if (from === null) return null;
  const to = Math.max(from, table.pageTo ?? from);
  return describePages(Array.from({ length: to - from + 1 }, (_, i) => from + i));
}

function currency(table: TableSchema): string {
  if (table.currency !== null) return `currency ${table.currency}`;
  return table.columns.some((column) => column.name === 'currency')
    ? 'currency given per row in the currency column'
    : 'currency not stated';
}

/** Whitespace runs as single spaces, cut to `max` characters with "…". */
function oneLine(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}
