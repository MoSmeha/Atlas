import type { ColumnType } from '@atlas/shared';

/** Columns Atlas recognises in BOQs and cost sheets; they get these exact SQL names. */
export const COLUMN_ROLES = ['item_code', 'description', 'unit', 'quantity', 'rate', 'amount', 'currency'] as const;
export type ColumnRole = (typeof COLUMN_ROLES)[number];

/** Extra columns every SQL table carries so answers can cite rows and skip totals. */
export const META_COLUMNS = {
  /** Excel row number as Excel shows it; null for PDF tables. */
  sheetRow: '_row',
  /** PDF page number; null for sheets. */
  page: '_page',
  /** 1 for "Total", "Sub-total" and "Carried forward" rows, which sums must skip. */
  isTotal: '_is_total',
  /** Nearest section heading above the row, for example "Bill 3 - Concrete Works". */
  section: '_section',
} as const;

export type CleanValue = string | number | null;

export interface CleanColumn {
  /** SQL column name: a role name when recognised, otherwise the header in snake_case. */
  name: string;
  /** Header text as written in the document. */
  label: string;
  type: ColumnType;
  role: ColumnRole | null;
}

export interface CleanRow {
  /** One value per column, in column order. Amounts are plain numbers. */
  values: CleanValue[];
  sheetRow: number | null;
  page: number | null;
  isTotal: boolean;
  section: string | null;
}

/** A table after cleaning: one header, typed columns, totals marked. */
export interface CleanTable {
  /** Text from the title rows above the header, if any. */
  title: string | null;
  sheet: string | null;
  pageFrom: number | null;
  pageTo: number | null;
  columns: CleanColumn[];
  rows: CleanRow[];
  /** Currency of the amounts when the table states one. */
  currency: string | null;
}

/** Lower-case ASCII snake_case safe for SQL; falls back when nothing usable is left (e.g. Arabic headers). */
export function sqlIdentifier(text: string, fallback: string): string {
  const cleaned = text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
    .replace(/_+$/g, '');
  if (cleaned === '') return fallback;
  return /^[0-9]/.test(cleaned) ? `c_${cleaned}` : cleaned;
}
