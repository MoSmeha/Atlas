import { clipAround, findTask, type ScheduleFields } from './schedule';
import { arabicPattern, excelSerialToIso, readDateText } from './scheduleDates';
import { COLUMN_ROLES, type CleanValue } from './table';

/** One SQL table loaded from a sheet, with its rows. */
export interface ScheduleTable {
  document: string;
  sheet: string;
  columns: { name: string; label: string }[];
  rows: { values: Record<string, CleanValue>; sheetRow: number | null; isTotal: boolean }[];
}

/** A dated row of a programme, milestone or deliverables sheet. */
export interface RowScheduleCandidate extends ScheduleFields {
  id: string;
  sheet: string;
  /** Row number as Excel shows it. */
  row: number;
}

const arabic = (words: string[]) => words.map(arabicPattern).join('|');
/** Headers that make a column of serial numbers a date column. */
const DATE_LABEL = new RegExp(
  `(?<![\\p{L}])(?:date|dates|start|finish|end|deadline|due|completion|commencement)(?![\\p{L}])|${arabic(['تاريخ', 'بداية', 'نهاية', 'موعد'])}`,
  'iu',
);
/** When a row has several dates, the one in a column like these is the milestone date. */
const FINISH_LABEL = new RegExp(
  `(?<![\\p{L}])(?:finish|end|completion|due|deadline)(?![\\p{L}])|${arabic(['نهاية', 'الانتهاء', 'الإنجاز', 'موعد'])}`,
  'iu',
);
const DEADLINE_LABEL = new RegExp(`(?<![\\p{L}])(?:due|deadline)(?![\\p{L}])|${arabic(['موعد'])}`, 'iu');
/** BOQ amounts and quantities are never dates, whatever their size. */
const ROLE_COLUMNS = new Set<string>(COLUMN_ROLES);

interface DateColumn {
  name: string;
  label: string;
  /** Numbers in the column are Excel serial dates. */
  serial: boolean;
}

interface CellDate {
  text: string;
  isoDate: string | null;
  hijri: string | null;
}

/**
 * One candidate per sheet row that holds a date, without ids. A column counts as dates when most of its values are
 * date text, or when its header says date, start, finish or due and most of its values are Excel serial dates.
 * The sentence lists the row's cells as "Header: value"; the date is taken from a finish or due column when the row
 * has several. Total rows are skipped.
 */
export function findTableScheduleRows(table: ScheduleTable): Omit<RowScheduleCandidate, 'id'>[] {
  const dateColumns = findDateColumns(table);
  if (dateColumns.length === 0) return [];
  const candidates: Omit<RowScheduleCandidate, 'id'>[] = [];
  for (const row of table.rows) {
    if (row.isTotal || row.sheetRow === null) continue;
    const dated = dateColumns.flatMap((column) => {
      const date = cellDate(row.values[column.name] ?? null, column.serial);
      return date === null ? [] : [{ column, date }];
    });
    const chosen = dated.find((entry) => FINISH_LABEL.test(entry.column.label)) ?? dated[0];
    if (chosen === undefined) continue;
    const sentence = rowText(table, row.values, dateColumns);
    candidates.push({
      kind: DEADLINE_LABEL.test(chosen.column.label) ? 'deadline' : (findTask(sentence)?.kind ?? 'date'),
      match: dated.map((entry) => `${entry.column.label}: ${entry.date.text}`).join('; '),
      sentence: clipAround(sentence, 0, 0),
      document: table.document,
      isoDate: chosen.date.isoDate,
      hijri: chosen.date.hijri,
      duration: null,
      sheet: table.sheet,
      row: row.sheetRow,
    });
  }
  return candidates;
}

function findDateColumns(table: ScheduleTable): DateColumn[] {
  return table.columns.flatMap((column): DateColumn[] => {
    const values = table.rows
      .filter((row) => !row.isTotal)
      .map((row) => row.values[column.name] ?? null)
      .filter((value) => value !== null && value !== '');
    if (values.length === 0) return [];
    const half = values.length / 2;
    const dateTexts = values.filter((value) => typeof value === 'string' && readDateText(value) !== null).length;
    if (dateTexts >= half) return [{ name: column.name, label: column.label, serial: false }];
    if (ROLE_COLUMNS.has(column.name) || !DATE_LABEL.test(column.label)) return [];
    const serials = values.filter((value) => typeof value === 'number' && excelSerialToIso(value) !== null).length;
    return serials >= half ? [{ name: column.name, label: column.label, serial: true }] : [];
  });
}

function cellDate(value: CleanValue, serial: boolean): CellDate | null {
  if (typeof value === 'string') {
    const mention = readDateText(value);
    return mention === null ? null : { text: mention.text, isoDate: mention.isoDate, hijri: mention.hijri };
  }
  if (typeof value === 'number' && serial) {
    const isoDate = excelSerialToIso(value);
    return isoDate === null ? null : { text: isoDate, isoDate, hijri: null };
  }
  return null;
}

/** "Activity: Excavation | Start: 2026-03-01 | Finish: 2026-04-15", with serial dates shown as yyyy-mm-dd. */
function rowText(table: ScheduleTable, values: Record<string, CleanValue>, dateColumns: DateColumn[]): string {
  const serialColumns = new Set(dateColumns.filter((column) => column.serial).map((column) => column.name));
  return table.columns
    .flatMap((column) => {
      const value = values[column.name] ?? null;
      if (value === null || value === '') return [];
      const shown = serialColumns.has(column.name) && typeof value === 'number' ? (excelSerialToIso(value) ?? value) : value;
      return [`${column.label}: ${shown}`];
    })
    .join(' | ');
}
