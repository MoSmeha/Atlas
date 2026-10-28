'use strict';
// Runs read-only SQL for QueryRunner on its own read-only connection. It is a separate process, not a worker
// thread, because a thread busy inside one long SQLite step cannot be terminated; a process can be killed.
const Database = require(process.env.ATLAS_BETTER_SQLITE || 'better-sqlite3');

let db = null;
let openError = null;
try {
  db = new Database(process.env.ATLAS_INDEX_PATH, { readonly: true, fileMustExist: true });
  db.pragma('query_only = ON');
} catch (error) {
  openError = `Could not open the index for reading: ${error.message}`;
}

process.on('message', (message) => {
  process.send(run(message));
});
process.on('disconnect', () => process.exit(0));
process.send({ ready: true });

function run({ id, sql, maxRows }) {
  if (db === null) return { id, ok: false, message: openError };
  try {
    const statement = db.prepare(sql);
    if (!statement.reader || !statement.readonly) {
      return { id, ok: false, message: 'Only read-only SELECT queries can run on the loaded tables.' };
    }
    statement.raw(true);
    const columns = statement.columns().map((column) => column.name);
    const rows = [];
    let truncated = false;
    for (const row of statement.iterate()) {
      if (rows.length >= maxRows) {
        truncated = true;
        break;
      }
      rows.push(row.map(clean));
    }
    return { id, ok: true, columns, rows, truncated };
  } catch (error) {
    return { id, ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

function clean(value) {
  if (value === null || typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Uint8Array) return `(binary data, ${value.length} bytes)`;
  return String(value);
}
