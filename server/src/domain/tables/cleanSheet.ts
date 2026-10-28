import type { ColumnType } from '@atlas/shared';
import { columnLetters } from '../cellRange';
import type { RawCell, SheetGrid } from '../document';
import { type CleanColumn, type CleanRow, type CleanTable, type ColumnRole, sqlIdentifier } from '../table';
import { cellAt, rowTexts } from './area';
import { isBlank } from './cellText';
import { cleanValue, columnType } from './columnTypes';
import { splitTables, type TableBlock } from './splitTables';
import { tableCurrency } from './tableCurrency';
import { headingText, isSectionHeading, isTotalRow } from './totalRows';

const MAX_TITLE_LENGTH = 300;
/** Columns of measures and money; section headings only use the text columns before the first of them. */
const MEASURE_ROLES: ReadonlySet<ColumnRole> = new Set(['unit', 'quantity', 'rate', 'amount', 'currency']);

interface SourceColumn {
  label: string;
  role: ColumnRole | null;
}

interface BodyRow {
  sheetRow: number;
  /** One cell per source column. */
  cells: RawCell[];
}

interface ClassifiedRow extends BodyRow {
  isTotal: boolean;
  section: string | null;
}

/**
 * Turns one sheet into clean tables. The header may sit below title rows, merged and two-row headers are joined, and a
 * sheet with several tables gives several. Empty rows are dropped, total rows marked, section headings carried down to
 * the rows below them, and columns typed and named for SQL with role names first. Amounts become plain numbers and the
 * currency comes from the header, the title or the cells. Sheets without a recognisable table give none.
 */
export function cleanSheet(grid: SheetGrid): CleanTable[] {
  return splitTables(grid)
    .map((block) => cleanBlock(grid, block))
    .filter((table) => table.rows.length > 0);
}

function cleanBlock(grid: SheetGrid, block: TableBlock): CleanTable {
  const title = tableTitle(grid, block);
  const { columns: sources, rows: body } = sourceRows(grid, block);
  const draftTypes = typesOf(sources, body);
  const rows = classifyRows(body, sources, draftTypes);
  const types = typesOf(sources, rows);
  const currency = tableCurrency(
    sources.map((column, i) => ({ label: column.label, role: column.role, type: types[i] ?? 'text' })),
    rows.map((row) => row.cells),
    title,
  );

  const columns = [...sources];
  if (currency.perRow !== null && !sources.some((column) => column.role === 'currency')) {
    columns.push({ label: 'Currency', role: 'currency' });
    types.push('text');
  }
  const currencyColumn = columns.findIndex((column) => column.role === 'currency');
  const names = columnNames(columns);
  return {
    title,
    sheet: grid.name,
    pageFrom: null,
    pageTo: null,
    columns: columns.map((column, i): CleanColumn => ({
      name: names[i] ?? `col_${i + 1}`,
      label: column.label,
      type: types[i] ?? 'text',
      role: column.role,
    })),
    rows: rows.map(
      (row, r): CleanRow => ({
        values: columns.map((_, i) =>
          i === currencyColumn && currency.perRow !== null
            ? (currency.perRow[r] ?? null)
            : cleanValue(row.cells[i] ?? null, types[i] ?? 'text'),
        ),
        sheetRow: row.sheetRow,
        page: null,
        isTotal: row.isTotal,
        section: row.section,
      }),
    ),
    currency: currency.currency,
  };
}

/** The text of the rows above the header, each row's cells joined with spaces and the rows with " - ". */
function tableTitle(grid: SheetGrid, block: TableBlock): string | null {
  const title = block.titleRows
    .map((row) =>
      rowTexts(grid, row, block.area)
        .filter((text) => text !== '')
        .join(' '),
    )
    .filter((text) => text !== '')
    .join(' - ');
  return title === '' ? null : title.slice(0, MAX_TITLE_LENGTH);
}

/** The rows under the header that are not empty and do not repeat it, and the columns that have a label or data. */
function sourceRows(grid: SheetGrid, block: TableBlock): { columns: SourceColumn[]; rows: BodyRow[] } {
  const { area, header } = block;
  const repeated = new Set(block.repeatedHeaders);
  const width = area.right - area.left + 1;
  const all: BodyRow[] = [];
  for (let row = header.bottom + 1; row <= area.bottom; row++) {
    if (repeated.has(row)) continue;
    const cells = Array.from({ length: width }, (_, i) => cellAt(grid, row, area.left + i));
    if (!cells.every(isBlank)) all.push({ sheetRow: row + 1, cells });
  }
  const kept = Array.from({ length: width }, (_, i) => i).filter(
    (i) => (header.labels[i] ?? '') !== '' || all.some((row) => !isBlank(row.cells[i] ?? null)),
  );
  const columns = kept.map((i): SourceColumn => ({
    label: header.labels[i] || `Column ${columnLetters(area.left + i + 1)}`,
    role: header.roles[i] ?? null,
  }));
  const rows = all.map((row) => ({ sheetRow: row.sheetRow, cells: kept.map((i) => row.cells[i] ?? null) }));
  return { columns, rows };
}

function typesOf(columns: readonly SourceColumn[], rows: readonly BodyRow[]): ColumnType[] {
  return columns.map((column, i) =>
    columnType(
      rows.map((row) => row.cells[i] ?? null),
      column.role,
    ),
  );
}

/**
 * Marks total rows and turns section headings into the section of the rows below them; headings in a row with no data
 * between them join with " - ", as in "Bill 1 - Substructure - 1.1 Earthworks". Heading rows are not data. A total right
 * after another total ("Total Bill 1" after "Sub-total 1.3") covers more than the last section, so it gets none.
 */
function classifyRows(rows: readonly BodyRow[], columns: readonly SourceColumn[], types: readonly ColumnType[]): ClassifiedRow[] {
  const headingColumns = leadingTextColumns(columns, types);
  const detailColumns = new Set(
    columns.flatMap((column, i) => (column.role === 'unit' || column.role === 'rate' ? [i] : [])),
  );
  const classified: ClassifiedRow[] = [];
  let section: string | null = null;
  let afterHeading = false;
  for (const row of rows) {
    const isTotal = isTotalRow(row.cells, detailColumns);
    if (!isTotal && isSectionHeading(row.cells, headingColumns)) {
      const text = headingText(row.cells);
      section = afterHeading && section !== null ? `${section} - ${text}` : text;
      afterHeading = true;
      continue;
    }
    const afterTotal = classified.at(-1)?.isTotal === true;
    classified.push({ ...row, isTotal, section: isTotal && afterTotal ? null : section });
    afterHeading = false;
  }
  return classified;
}

/** The text columns before the first measure or number column; none when the table has no such column. */
function leadingTextColumns(columns: readonly SourceColumn[], types: readonly ColumnType[]): Set<number> {
  const boundary = columns.findIndex(
    (column, i) => (column.role !== null && MEASURE_ROLES.has(column.role)) || types[i] !== 'text',
  );
  return new Set(Array.from({ length: Math.max(boundary, 0) }, (_, i) => i));
}

/** Role columns take their role name; the others a snake_case form of their label, numbered on clashes. */
function columnNames(columns: readonly SourceColumn[]): string[] {
  const used = new Set<string>(columns.flatMap((column) => (column.role === null ? [] : [column.role])));
  return columns.map((column, i) => {
    if (column.role !== null) return column.role;
    const base = sqlIdentifier(column.label, `col_${i + 1}`);
    let name = base;
    for (let n = 2; used.has(name); n++) name = `${base}_${n}`;
    used.add(name);
    return name;
  });
}
