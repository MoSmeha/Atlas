import type { ColumnType } from '@atlas/shared';
import { columnLetters } from '../cellRange';
import type { RawCell, SheetGrid } from '../document';
import type { CleanTable } from '../table';
import { cellAt, rowTexts } from './area';
import { buildTable, columnTypes, leadingTextColumns, type SourceColumn, type SourceRow } from './buildTable';
import { isBlank } from './cellText';
import { splitTables, type TableBlock } from './splitTables';
import { headingText, isSectionHeading, isTotalRow } from './totalRows';

const MAX_TITLE_LENGTH = 300;

interface BodyRow {
  sheetRow: number;
  /** One cell per source column. */
  cells: RawCell[];
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
  const rows = classifyRows(body, sources, columnTypes(sources, body));
  return buildTable({ title, sheet: grid.name, pageFrom: null, pageTo: null }, sources, rows);
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

/**
 * Marks total rows and turns section headings into the section of the rows below them; headings in a row with no data
 * between them join with " - ", as in "Bill 1 - Substructure - 1.1 Earthworks". Heading rows are not data. A total right
 * after another total ("Total Bill 1" after "Sub-total 1.3") covers more than the last section, so it gets none.
 */
function classifyRows(rows: readonly BodyRow[], columns: readonly SourceColumn[], types: readonly ColumnType[]): SourceRow[] {
  const headingColumns = leadingTextColumns(columns, types);
  const detailColumns = new Set(
    columns.flatMap((column, i) => (column.role === 'unit' || column.role === 'rate' ? [i] : [])),
  );
  const classified: SourceRow[] = [];
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
    classified.push({ ...row, page: null, isTotal, section: isTotal && afterTotal ? null : section });
    afterHeading = false;
  }
  return classified;
}
