import type { Source } from '@atlas/shared';
import { rowRanges } from '../../domain/rowRanges';
import type { RevisionDiff, RevisionRow } from '../../domain/revisions';
import type { TableSchema } from '../ports/DocumentIndex';
import { tableSources, uniqueSources } from './boqReport';

/** One document's side of a comparison: its BOQ tables with every row, totals included. */
export interface RevisionSide {
  document: string;
  tables: { schema: TableSchema; rows: RevisionRow[] }[];
}

/**
 * Where the differences are, in both documents, A first: the cited Excel rows as ranges per sheet, and one
 * PDF source per page and item code. With no differences, every compared table of both documents is cited.
 */
export function revisionSources(diff: RevisionDiff, a: RevisionSide, b: RevisionSide): Source[] {
  const citedA = [...diff.removed, ...diff.changed.map((item) => item.a)];
  const citedB = [...diff.added, ...diff.changed.map((item) => item.b)];
  if (citedA.length === 0 && citedB.length === 0) {
    return uniqueSources([a, b].flatMap((side) => side.tables.flatMap(({ schema, rows }) => tableSources(schema, rows))));
  }
  return uniqueSources([...sideSources(a, citedA), ...sideSources(b, citedB)]);
}

function sideSources(side: RevisionSide, cited: RevisionRow[]): Source[] {
  const rows = side.tables.flatMap((table) => table.rows);
  const sources: Source[] = [];
  const citedSheets = new Set(cited.map((row) => row.sheet));
  const sheets = [...new Set(rows.flatMap((row) => (row.sheet !== null && citedSheets.has(row.sheet) ? [row.sheet] : [])))];
  for (const sheet of sheets) {
    const onSheet = (row: RevisionRow) => row.sheet === sheet && row.sheetRow !== null;
    const numbers = (list: RevisionRow[]) => list.filter(onSheet).map((row) => row.sheetRow as number);
    for (const { from, to } of rowRanges(numbers(cited), numbers(rows))) {
      sources.push({ kind: 'excel', document: side.document, sheet, rowFrom: from, rowTo: to });
    }
  }
  const onPages = cited
    .filter((row) => (row.sheet === null || row.sheetRow === null) && row.page !== null)
    .toSorted((x, y) => (x.page as number) - (y.page as number));
  for (const row of onPages) {
    sources.push({ kind: 'pdf', document: side.document, page: row.page as number, quote: row.itemCode });
  }
  return sources;
}
