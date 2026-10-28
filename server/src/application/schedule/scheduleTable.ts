import type { ExcelSource, PdfSource, Source } from '@atlas/shared';
import { toPageRanges } from '../../domain/pageRanges';
import type { CleanValue } from '../../domain/table';
import type { ConfirmedItem } from './confirmCandidates';

export const SCHEDULE_COLUMNS = ['kind', 'label', 'date', 'hijri', 'duration', 'document', 'page_or_rows', 'sentence'];

/**
 * The schedule as rows in SCHEDULE_COLUMNS order, built from the candidates' own text, dates and locations.
 * Dated items come first in date order, then the rest in document order. Sources hold one entry per PDF page,
 * quoting its first sentence, and one per run of consecutive sheet rows.
 */
export function scheduleTable(items: ConfirmedItem[]): { columns: string[]; rows: CleanValue[][]; sources: Source[] } {
  const ordered = items
    .map((item, order) => ({ item, order }))
    .sort((a, b) => compareDates(a.item.candidate.isoDate, b.item.candidate.isoDate) || a.order - b.order)
    .map((entry) => entry.item);
  const rows = ordered.map(({ candidate, kind, label }): CleanValue[] => [
    kind,
    label,
    candidate.isoDate,
    candidate.hijri,
    candidate.duration,
    candidate.document,
    'page' in candidate ? `page ${candidate.page}` : `${candidate.sheet} row ${candidate.row}`,
    candidate.sentence,
  ]);
  return { columns: SCHEDULE_COLUMNS, rows, sources: sourcesOf(ordered) };
}

/** Dated before undated, then yyyy-mm-dd text order, which is date order ("2026-03" sorts before "2026-03-01"). */
function compareDates(a: string | null, b: string | null): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function sourcesOf(items: ConfirmedItem[]): Source[] {
  const pages = new Map<string, PdfSource>();
  const sheetRows = new Map<string, { document: string; sheet: string; rows: number[] }>();
  for (const { candidate } of items) {
    if ('page' in candidate) {
      const key = `${candidate.document}\n${candidate.page}`;
      if (!pages.has(key)) {
        const quote = candidate.sentence.replace(/^…|…$/g, '');
        pages.set(key, { kind: 'pdf', document: candidate.document, page: candidate.page, quote });
      }
    } else {
      const key = `${candidate.document}\n${candidate.sheet}`;
      const entry = sheetRows.get(key) ?? { document: candidate.document, sheet: candidate.sheet, rows: [] };
      entry.rows.push(candidate.row);
      sheetRows.set(key, entry);
    }
  }
  const excel = [...sheetRows.values()].flatMap(({ document, sheet, rows }) =>
    toPageRanges(rows).map((range): ExcelSource => ({ kind: 'excel', document, sheet, rowFrom: range.from, rowTo: range.to })),
  );
  return [...pages.values(), ...excel];
}
