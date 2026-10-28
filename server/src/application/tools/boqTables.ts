import type { DocumentSummary } from '@atlas/shared';
import type { BoqRow } from '../../domain/boqArithmetic';
import type { CleanValue } from '../../domain/table';
import type { DocumentIndex, TableRowRecord, TableSchema } from '../ports/DocumentIndex';
import { findDocument } from './findDocument';
import { ToolError } from './Tool';

/** SQL columns a table needs before its arithmetic can be checked. */
export const BOQ_COLUMNS = ['quantity', 'rate', 'amount'] as const;

/** How many BOQ table names an error lists. */
const MAX_LISTED = 30;

/** A priced table: it has quantity, rate and amount columns. */
export function isBoqTable(table: TableSchema): boolean {
  const names = new Set(table.columns.map((column) => column.name));
  return BOQ_COLUMNS.every((name) => names.has(name));
}

/**
 * The BOQ tables to check: one named table, the tables of one document, or every BOQ table loaded.
 * Throws a ToolError that says why when nothing fits.
 */
export function pickBoqTables(index: DocumentIndex, document: string | null, table: string | null): TableSchema[] {
  const all = index.tables();
  const boq = all.filter(isBoqTable);
  const doc = document === null ? null : findDocument(index, document, 'Use one of these names, or null for every document.');

  if (table !== null) {
    const wanted = table.trim().toLowerCase();
    const named = all.find((candidate) => candidate.name.toLowerCase() === wanted);
    if (!named) throw new ToolError(`No loaded table is called "${table}". ${listed(boq)}`);
    if (!isBoqTable(named)) {
      throw new ToolError(`${named.name} has no quantity, rate and amount columns, so its arithmetic cannot be checked. ${listed(boq)}`);
    }
    if (doc && named.document !== doc.path) {
      throw new ToolError(`${named.name} comes from ${named.document}, not ${doc.path}. Give its document, or null for document.`);
    }
    return [named];
  }

  const scoped = doc ? boq.filter((candidate) => candidate.document === doc.path) : boq;
  if (scoped.length > 0) return scoped;
  if (doc) throw new ToolError(`${noBoqIn(doc)} ${listed(boq)}`);
  throw new ToolError(
    'No loaded document has a table with quantity, rate and amount columns, so there is no BOQ arithmetic to check. ' +
      'Say that no priced bill of quantities was found in the loaded tables; do not check amounts from page text.',
  );
}

/** A stored table row in the shape the arithmetic check reads. */
export function toBoqRow(record: TableRowRecord): BoqRow {
  return {
    itemCode: text(record.values['item_code']),
    description: text(record.values['description']),
    quantity: number(record.values['quantity']),
    rate: number(record.values['rate']),
    amount: number(record.values['amount']),
    isTotal: record.isTotal,
    section: record.section,
    sheetRow: record.sheetRow,
    page: record.page,
  };
}

/** The row's own currency cell when the table has one, otherwise the table's currency. */
export function rowCurrency(record: TableRowRecord, table: TableSchema): string | null {
  const cell = record.values['currency'];
  return typeof cell === 'string' && cell.trim() !== '' ? cell.trim() : table.currency;
}

function noBoqIn(doc: DocumentSummary): string {
  if (doc.status !== 'ok') {
    return `${doc.path} could not be read (${doc.statusDetail ?? doc.status}), so it has no tables to check.`;
  }
  return `${doc.path} has no table with quantity, rate and amount columns, so there is no BOQ arithmetic to check in it.`;
}

function listed(boq: TableSchema[]): string {
  if (boq.length === 0) return 'No loaded table has quantity, rate and amount columns.';
  const names = boq.slice(0, MAX_LISTED).map((table) => `${table.name} (${table.document})`);
  const more = boq.length > MAX_LISTED ? ` and ${boq.length - MAX_LISTED} more` : '';
  return `Tables with quantity, rate and amount columns: ${names.join(', ')}${more}.`;
}

function number(value: CleanValue | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function text(value: CleanValue | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}
