import type Database from 'better-sqlite3';
import { quoteIdentifier } from './quoteIdentifier';

/** Bump when the DDL or foldText changes; a file with another version is emptied and rebuilt. */
export const SCHEMA_VERSION = 1;

/** SQL function the FTS triggers call with chunk text; SqliteIndex registers it as foldText. */
export const FOLD_FUNCTION = 'atlas_fold';

/** Tables Atlas owns. Every loaded document table is created next to these with a `t_` name. */
const DDL = `
CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE documents (
  path TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  status_detail TEXT,
  mtime_ms REAL NOT NULL,
  size INTEGER NOT NULL,
  page_count INTEGER,
  scanned_pages TEXT NOT NULL DEFAULT '[]',
  sheets TEXT NOT NULL DEFAULT '[]',
  language TEXT,
  currencies TEXT NOT NULL DEFAULT '[]',
  classification TEXT
);

CREATE TABLE pages (
  path TEXT NOT NULL REFERENCES documents (path) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  text TEXT NOT NULL,
  PRIMARY KEY (path, number)
);

-- AUTOINCREMENT so a chunk id is never reused: an embedding computed for a replaced chunk then matches nothing.
CREATE TABLE chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL REFERENCES documents (path) ON DELETE CASCADE,
  page INTEGER NOT NULL,
  text TEXT NOT NULL,
  embedding BLOB
);
CREATE INDEX chunks_by_path ON chunks (path);
CREATE INDEX chunks_pending ON chunks (id) WHERE embedding IS NULL;

CREATE VIRTUAL TABLE chunks_fts USING fts5 (
  text,
  content = 'chunks',
  content_rowid = 'id',
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER chunks_fts_insert AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts (rowid, text) VALUES (new.id, ${FOLD_FUNCTION}(new.text));
END;
CREATE TRIGGER chunks_fts_delete AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts (chunks_fts, rowid, text) VALUES ('delete', old.id, ${FOLD_FUNCTION}(old.text));
END;
CREATE TRIGGER chunks_fts_update AFTER UPDATE OF text ON chunks BEGIN
  INSERT INTO chunks_fts (chunks_fts, rowid, text) VALUES ('delete', old.id, ${FOLD_FUNCTION}(old.text));
  INSERT INTO chunks_fts (rowid, text) VALUES (new.id, ${FOLD_FUNCTION}(new.text));
END;

CREATE TABLE table_catalog (
  name TEXT PRIMARY KEY,
  path TEXT NOT NULL REFERENCES documents (path) ON DELETE CASCADE,
  title TEXT,
  sheet TEXT,
  page_from INTEGER,
  page_to INTEGER,
  columns TEXT NOT NULL,
  row_count INTEGER NOT NULL,
  currency TEXT
);
CREATE INDEX table_catalog_by_path ON table_catalog (path);

CREATE TABLE sheet_rows (
  path TEXT NOT NULL REFERENCES documents (path) ON DELETE CASCADE,
  sheet TEXT NOT NULL,
  row_number INTEGER NOT NULL,
  cells TEXT NOT NULL,
  PRIMARY KEY (path, sheet, row_number)
);
`;

/**
 * Tables added after version 1, created in place when missing, so an index built earlier keeps its content instead
 * of being rebuilt (and embedded again).
 */
const ADDED = `
CREATE TABLE IF NOT EXISTS excluded (
  path TEXT PRIMARY KEY
);
`;

/** Creates the schema in a new file, or empties and recreates it when the file was written by another version. */
export function applySchema(db: Database.Database): void {
  const version = storedVersion(db);
  if (version !== SCHEMA_VERSION) {
    db.transaction(() => {
      if (version !== null) dropEverything(db);
      db.exec(DDL);
      db.prepare("INSERT INTO meta (key, value) VALUES ('schema_version', ?)").run(String(SCHEMA_VERSION));
    })();
  }
  db.exec(ADDED);
}

/** Null for a new, empty file; -1 when tables exist but no version does. */
function storedVersion(db: Database.Database): number | null {
  const tables = db.prepare("SELECT count(*) FROM sqlite_master WHERE type = 'table'").pluck().get() as number;
  if (tables === 0) return null;
  const hasMeta = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'meta'").get() !== undefined;
  const value = hasMeta ? db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").pluck().get() : undefined;
  return typeof value === 'string' ? Number(value) : -1;
}

/** Drops the FTS table first (it owns shadow tables), then every other table, newest first so children go before parents. */
function dropEverything(db: Database.Database): void {
  const names = (sql: string) => db.prepare(sql).pluck().all() as string[];
  for (const name of names("SELECT name FROM sqlite_master WHERE type = 'table' AND sql LIKE 'CREATE VIRTUAL TABLE%'")) {
    db.exec(`DROP TABLE IF EXISTS ${quoteIdentifier(name)}`);
  }
  for (const name of names("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid DESC")) {
    db.exec(`DROP TABLE IF EXISTS ${quoteIdentifier(name)}`);
  }
}
