import type { ColumnType, TableColumn } from '@atlas/shared';
import type Database from 'better-sqlite3';
import { META_COLUMNS, sqlIdentifier, type CleanColumn, type CleanTable, type CleanValue } from '../../domain/table';
import { quoteIdentifier } from './quoteIdentifier';

const SQL_TYPES: Record<ColumnType, string> = { text: 'TEXT', number: 'REAL', integer: 'INTEGER' };

/**
 * Creates one real SQL table per clean table of a document, named `t_<document>_<sheet or page>` and
 * numbered `_2`, `_3` on clashes, and records each in table_catalog. Call inside the save transaction.
 */
export function writeTables(db: Database.Database, path: string, documentName: string, tables: CleanTable[]): void {
  const taken = new Set(db.prepare('SELECT lower(name) FROM sqlite_master').pluck().all() as string[]);
  const catalog = db.prepare(
    `INSERT INTO table_catalog (name, path, title, sheet, page_from, page_to, columns, row_count, currency)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const table of tables) {
    const name = unique(tableBaseName(documentName, table), taken);
    taken.add(name);
    const columns = sqlColumns(table.columns);
    createTable(db, name, columns);
    insertRows(db, name, columns.length, table);
    catalog.run(name, path, table.title, table.sheet, table.pageFrom, table.pageTo, JSON.stringify(columns), table.rows.length, table.currency);
  }
}

/** Drops every SQL table a document created and its catalog rows. */
export function dropTables(db: Database.Database, path: string): void {
  const names = db.prepare('SELECT name FROM table_catalog WHERE path = ?').pluck().all(path) as string[];
  for (const name of names) db.exec(`DROP TABLE IF EXISTS ${quoteIdentifier(name)}`);
  db.prepare('DELETE FROM table_catalog WHERE path = ?').run(path);
}

/** `t_<document>_<sheet>` for sheets, `t_<document>_p<page>` for PDF tables; at most 57 characters before a clash suffix. */
export function tableBaseName(documentName: string, table: CleanTable): string {
  const document = slug(documentName.replace(/\.[^.]+$/, ''), 30) || 'doc';
  const part =
    table.sheet !== null ? slug(table.sheet, 24) || 'sheet' : table.pageFrom !== null ? `p${table.pageFrom}` : 'table';
  return `t_${document}_${part}`;
}

/** Column names as stored: safe identifiers, unique within the table, never one of the meta columns. */
export function sqlColumns(columns: CleanColumn[]): TableColumn[] {
  const used = new Set<string>(Object.values(META_COLUMNS));
  return columns.map((column, i) => {
    const name = unique(sqlIdentifier(column.name, `col_${i + 1}`), used);
    used.add(name);
    return { name, label: column.label, type: column.type };
  });
}

function createTable(db: Database.Database, name: string, columns: TableColumn[]): void {
  const definitions = [
    ...columns.map((column) => `${quoteIdentifier(column.name)} ${SQL_TYPES[column.type]}`),
    `${META_COLUMNS.sheetRow} INTEGER`,
    `${META_COLUMNS.page} INTEGER`,
    `${META_COLUMNS.isTotal} INTEGER NOT NULL DEFAULT 0`,
    `${META_COLUMNS.section} TEXT`,
  ];
  db.exec(`CREATE TABLE ${quoteIdentifier(name)} (${definitions.join(', ')})`);
}

function insertRows(db: Database.Database, name: string, columnCount: number, table: CleanTable): void {
  const insert = db.prepare(`INSERT INTO ${quoteIdentifier(name)} VALUES (${Array(columnCount + 4).fill('?').join(', ')})`);
  for (const row of table.rows) {
    const values = Array.from({ length: columnCount }, (_, i) => storable(row.values[i] ?? null));
    insert.run(...values, row.sheetRow, row.page, row.isTotal ? 1 : 0, row.section);
  }
}

function storable(value: CleanValue): CleanValue {
  return typeof value === 'number' && !Number.isFinite(value) ? null : value;
}

function slug(text: string, maxLength: number): string {
  const cleaned = text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+/, '');
  return cleaned.slice(0, maxLength).replace(/_+$/, '');
}

function unique(base: string, taken: Set<string>): string {
  let name = base;
  for (let n = 2; taken.has(name); n++) name = `${base}_${n}`;
  return name;
}
