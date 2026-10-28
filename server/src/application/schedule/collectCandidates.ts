import type { DocumentSummary } from '@atlas/shared';
import { findScheduleCandidates, type ScheduleCandidate } from '../../domain/schedule';
import { findTableScheduleRows, type RowScheduleCandidate } from '../../domain/scheduleTables';
import type { DocumentIndex } from '../ports/DocumentIndex';

/** A candidate from PDF page text (it has a page) or from a sheet row (it has a sheet and row). */
export type Candidate = ScheduleCandidate | RowScheduleCandidate;

/** How many candidates one confirmation call checks. */
export const MAX_CANDIDATES = 200;
/** Dated rows taken from one table, so a 10,000-row ledger cannot crowd out the programme. */
export const MAX_ROWS_PER_TABLE = 60;

export interface CollectedCandidates {
  /** At most MAX_CANDIDATES, dated ones first, in document order. */
  candidates: Candidate[];
  /** How many were found before the cap. */
  found: number;
  /** Tables with more dated rows than MAX_ROWS_PER_TABLE. */
  cutTables: { document: string; sheet: string; datedRows: number }[];
}

/** Schedule candidates from the text of every PDF page and the dated rows of every Excel table in the documents. */
export function collectCandidates(index: DocumentIndex, documents: DocumentSummary[]): CollectedCandidates {
  const pages = documents
    .filter((doc) => doc.kind === 'pdf' && doc.pageCount !== null)
    .flatMap((doc) =>
      index
        .readPages(doc.path, 1, doc.pageCount ?? 0)
        .map((page) => ({ document: doc.path, page: page.number, text: page.text })),
    );
  const fromPages = findScheduleCandidates(pages);

  const workbooks = new Set(documents.filter((doc) => doc.kind === 'excel').map((doc) => doc.path));
  const cutTables: CollectedCandidates['cutTables'] = [];
  const datedRows = index.tables().flatMap((table) => {
    if (!workbooks.has(table.document) || table.sheet === null) return [];
    const sheet = table.sheet;
    const rows = index.tableRows(table.name);
    const dated = findTableScheduleRows({ document: table.document, sheet, columns: table.columns, rows });
    if (dated.length > MAX_ROWS_PER_TABLE) cutTables.push({ document: table.document, sheet, datedRows: dated.length });
    return dated.slice(0, MAX_ROWS_PER_TABLE);
  });
  const fromTables: RowScheduleCandidate[] = datedRows.map((row, i) => ({ id: `e${i + 1}`, ...row }));

  const all: Candidate[] = [...fromPages, ...fromTables];
  return { candidates: keepDatedFirst(all, MAX_CANDIDATES), found: all.length, cutTables };
}

/** Keeps `limit` candidates: those with a date first, then durations, then undated tasks; document order is kept. */
function keepDatedFirst(candidates: Candidate[], limit: number): Candidate[] {
  if (candidates.length <= limit) return candidates;
  const rank = (candidate: Candidate) =>
    candidate.isoDate !== null || candidate.hijri !== null ? 0 : candidate.kind === 'duration' ? 1 : 2;
  const kept = new Set(
    candidates
      .map((candidate, order) => ({ candidate, order, rank: rank(candidate) }))
      .sort((a, b) => a.rank - b.rank || a.order - b.order)
      .slice(0, limit)
      .map((entry) => entry.candidate),
  );
  return candidates.filter((candidate) => kept.has(candidate));
}
