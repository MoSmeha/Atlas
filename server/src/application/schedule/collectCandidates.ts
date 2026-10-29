import type { DocumentSummary } from '@atlas/shared';
import { findScheduleCandidates, findTask, type ScheduleCandidate } from '../../domain/schedule';
import { mergeRepeats } from '../../domain/scheduleRepeats';
import { findTableScheduleRows, type RowScheduleCandidate } from '../../domain/scheduleTables';
import type { DocumentIndex } from '../ports/DocumentIndex';

/** A candidate from PDF page text (it has a page) or from a sheet row (it has a sheet and row). */
export type Candidate = ScheduleCandidate | RowScheduleCandidate;

/** How many candidates one extract_schedule call checks: three batches of 150. */
export const MAX_CANDIDATES = 450;
/** Dated rows taken from one table, so a 10,000-row ledger cannot crowd out the programme. */
export const MAX_ROWS_PER_TABLE = 60;

export interface CutTable {
  document: string;
  sheet: string;
  datedRows: number;
}

/** One document's candidates, sentences that repeat one wording merged; ids are numbered later. */
export interface DocumentCandidates {
  document: string;
  candidates: Candidate[];
  /** Sentences merged into an earlier one with the same wording. */
  repeats: number;
  /** Tables with more dated rows than MAX_ROWS_PER_TABLE. */
  cutTables: CutTable[];
}

export interface CollectedCandidates {
  /** At most MAX_CANDIDATES, the most schedule-like first, in document order; ids c1, c2 (pages) and e1, e2 (rows). */
  candidates: Candidate[];
  /** How many were found, repeats merged, before the cap. */
  found: number;
  /** Per document, how many sentences repeated an earlier wording and were merged. */
  repeats: { document: string; count: number }[];
  /** Per document, how many candidates the cap left out. */
  skipped: { document: string; count: number }[];
  cutTables: CutTable[];
}

/** Schedule candidates in one document: the text of every PDF page, or the dated rows of every Excel table. */
export function documentCandidates(index: DocumentIndex, doc: DocumentSummary): DocumentCandidates {
  if (doc.kind === 'pdf') {
    const pages =
      doc.pageCount === null
        ? []
        : index.readPages(doc.path, 1, doc.pageCount).map((page) => ({ document: doc.path, page: page.number, text: page.text }));
    const merged = mergeRepeats(findScheduleCandidates(pages));
    const repeats = merged.reduce((total, entry) => total + entry.repeats, 0);
    return { document: doc.path, candidates: merged.map((entry) => entry.candidate), repeats, cutTables: [] };
  }
  const cutTables: CutTable[] = [];
  const rows = index.tables().flatMap((table) => {
    if (table.document !== doc.path || table.sheet === null) return [];
    const sheet = table.sheet;
    const dated = findTableScheduleRows({ document: table.document, sheet, columns: table.columns, rows: index.tableRows(table.name) });
    if (dated.length > MAX_ROWS_PER_TABLE) cutTables.push({ document: table.document, sheet, datedRows: dated.length });
    return dated.slice(0, MAX_ROWS_PER_TABLE);
  });
  const candidates = rows.map((row, i): RowScheduleCandidate => ({ id: `e${i + 1}`, ...row }));
  return { document: doc.path, candidates, repeats: 0, cutTables };
}

/**
 * Picks the candidates to check from every document's: all of them when they fit in `limit`, otherwise the most
 * schedule-like (see `priority`), kept in document order. Numbers them c1, c2 for page text and e1, e2 for rows.
 */
export function selectCandidates(documents: DocumentCandidates[], limit = MAX_CANDIDATES): CollectedCandidates {
  const all = documents.flatMap((doc) => doc.candidates);
  const kept = all.length <= limit ? new Set(all) : mostScheduleLike(all, limit);
  let pages = 0;
  let rows = 0;
  const candidates = all
    .filter((candidate) => kept.has(candidate))
    .map((candidate): Candidate => ({ ...candidate, id: 'page' in candidate ? `c${++pages}` : `e${++rows}` }));
  return {
    candidates,
    found: all.length,
    repeats: documents.filter((doc) => doc.repeats > 0).map((doc) => ({ document: doc.document, count: doc.repeats })),
    skipped: documents
      .map((doc) => ({ document: doc.document, count: doc.candidates.filter((candidate) => !kept.has(candidate)).length }))
      .filter((doc) => doc.count > 0),
    cutTables: documents.flatMap((doc) => doc.cutTables),
  };
}

function mostScheduleLike(candidates: Candidate[], limit: number): Set<Candidate> {
  return new Set(
    candidates
      .map((candidate, order) => ({ candidate, order, rank: priority(candidate) }))
      .sort((a, b) => a.rank - b.rank || a.order - b.order)
      .slice(0, limit)
      .map((entry) => entry.candidate),
  );
}

/**
 * Lower is checked first: a date tied to a deadline, milestone or deliverable; any other date; a duration tied to
 * a task ("submit within 28 days"); any other duration; then task sentences with no date at all.
 */
function priority(candidate: Candidate): number {
  const dated = candidate.isoDate !== null || candidate.hijri !== null;
  const task =
    candidate.kind === 'deadline' ||
    candidate.kind === 'milestone' ||
    candidate.kind === 'deliverable' ||
    findTask(candidate.sentence) !== null;
  if (dated) return task ? 0 : 1;
  if (candidate.kind === 'duration') return task ? 2 : 3;
  return 4;
}
