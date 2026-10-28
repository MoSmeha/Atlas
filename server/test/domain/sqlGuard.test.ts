import { describe, expect, it } from 'vitest';
import { validateSelect } from '../../src/domain/sqlGuard';

function accepted(sql: string): string {
  const check = validateSelect(sql);
  if (!check.ok) throw new Error(`Expected the query to pass, got: ${check.reason}`);
  return check.sql;
}

function rejected(sql: string): string {
  const check = validateSelect(sql);
  if (check.ok) throw new Error(`Expected the query to be refused: ${sql}`);
  return check.reason;
}

describe('validateSelect', () => {
  it('passes a plain SELECT unchanged', () => {
    const sql = 'SELECT item_code, amount, _row FROM t_boq WHERE _is_total = 0 AND amount > 100000';
    expect(accepted(sql)).toBe(sql);
  });

  it('passes lower case, leading spaces and a trailing semicolon, which it drops', () => {
    expect(accepted('  select count(*) from t_boq;  ')).toBe('select count(*) from t_boq');
    expect(accepted('SELECT 1;;\n')).toBe('SELECT 1');
  });

  it('passes WITH queries that end in a SELECT, recursive ones too', () => {
    expect(accepted('WITH big AS (SELECT * FROM t WHERE amount > 5) SELECT count(*) FROM big')).toContain('WITH big');
    expect(accepted('with recursive n(x) as (select 1 union all select x + 1 from n where x < 5) select x from n')).toContain(
      'recursive',
    );
    expect(accepted('WITH a(v) AS (VALUES (1), (2)), b AS (SELECT v FROM a) SELECT * FROM b')).toContain('VALUES');
  });

  it('strips comments, even ones that hide keywords or semicolons', () => {
    expect(accepted('/* DROP TABLE t */ SELECT 1')).toBe('SELECT 1');
    expect(accepted('-- PRAGMA writable_schema\nSELECT amount FROM t -- ; DELETE FROM t')).toBe('SELECT amount FROM t');
    expect(accepted('SELECT/**/amount FROM t /* ; ATTACH */ WHERE 1')).toBe('SELECT amount FROM t   WHERE 1');
    expect(accepted('SELECT 1 /* never closed; DROP TABLE t')).toBe('SELECT 1');
  });

  it('allows keywords and semicolons inside text values', () => {
    expect(accepted("SELECT * FROM t WHERE lower(description) LIKE '%drop%delete%'")).toContain("'%drop%delete%'");
    expect(accepted("SELECT * FROM t WHERE note = 'a; DROP TABLE t; --'")).toContain("'a; DROP TABLE t; --'");
    expect(accepted("SELECT * FROM t WHERE code LIKE 'A--%'")).toBe("SELECT * FROM t WHERE code LIKE 'A--%'");
  });

  it('keeps a doubled quote inside a text value from ending it early', () => {
    const sql = "SELECT * FROM t WHERE note = 'x'' ; DROP TABLE t; --'";
    expect(accepted(sql)).toBe(sql);
  });

  it('allows keywords used as quoted names', () => {
    expect(accepted('SELECT "update", `delete`, [drop], "Create Date" FROM t')).toContain('"update"');
  });

  it('allows names that only contain a keyword', () => {
    expect(accepted('SELECT updated_at, insert_no, created_by, drop_height FROM t')).toContain('drop_height');
  });

  it('allows replace() as the string function', () => {
    expect(accepted("SELECT replace(description, 'mm', ' mm') FROM t")).toContain('replace(');
    expect(accepted("SELECT REPLACE (item_code, '.', '') FROM t")).toContain('REPLACE (');
  });

  it('allows read-only table functions whose names start with pragma_', () => {
    expect(accepted("SELECT name FROM pragma_table_info('t_boq')")).toContain('pragma_table_info');
  });

  it('keeps Arabic text exactly', () => {
    const sql = "SELECT البند, amount FROM t WHERE description LIKE '%خرسانة%'";
    expect(accepted(sql)).toBe(sql);
  });

  it('refuses more than one statement', () => {
    expect(rejected('SELECT 1; DROP TABLE t')).toBe(
      'Send one statement at a time; this query has 2 statements separated by semicolons.',
    );
    expect(rejected("SELECT * FROM t WHERE a = 'b'; ATTACH 'evil.db' AS e")).toContain('2 statements');
    expect(rejected('SELECT 1; SELECT 2;')).toContain('2 statements');
  });

  it('refuses statements that are not SELECT or WITH', () => {
    expect(rejected('DELETE FROM t')).toBe('Only SELECT queries can run (WITH ... SELECT is fine); this one starts with "DELETE".');
    expect(rejected('PRAGMA table_info(t)')).toContain('starts with "PRAGMA"');
    expect(rejected('EXPLAIN SELECT 1')).toContain('starts with "EXPLAIN"');
    expect(rejected('VALUES (1)')).toContain('starts with "VALUES"');
    expect(rejected('(SELECT 1)')).toContain('starts with "("');
    expect(rejected('REPLACE INTO t VALUES (1)')).toContain('starts with "REPLACE"');
  });

  it('refuses every forbidden keyword anywhere in a SELECT', () => {
    const cases: [string, string][] = [
      ['SELECT 1 FROM t WHERE 0 OR (ATTACH)', 'ATTACH'],
      ['SELECT detach FROM t', 'DETACH'],
      ['SELECT * FROM t WHERE pragma = 1', 'PRAGMA'],
      ['SELECT insert FROM t', 'INSERT'],
      ['SELECT * FROM t ORDER BY update', 'UPDATE'],
      ['SELECT delete FROM t', 'DELETE'],
      ['SELECT replace FROM t', 'REPLACE'],
      ['SELECT create FROM t', 'CREATE'],
      ['SELECT * FROM t GROUP BY drop', 'DROP'],
      ['SELECT Alter FROM t', 'ALTER'],
      ['SELECT vacuum FROM t', 'VACUUM'],
      ['SELECT reindex FROM t', 'REINDEX'],
      ['SELECT analyze FROM t', 'ANALYZE'],
    ];
    for (const [sql, word] of cases) {
      expect(rejected(sql)).toContain(`${word} is not allowed: only read-only SELECT queries can run.`);
    }
    expect(rejected('SELECT * FROM t GROUP BY drop')).toContain('If drop is a column name, put it in double quotes.');
  });

  it('refuses load_extension however it is written', () => {
    const reason = 'load_extension is not allowed: queries may only read the loaded tables.';
    expect(rejected("SELECT load_extension('evil.dll')")).toBe(reason);
    expect(rejected("SELECT LOAD_EXTENSION ('evil')")).toBe(reason);
    expect(rejected("SELECT \"load_extension\"('evil')")).toBe(reason);
    expect(rejected("SELECT [load_extension]('evil')")).toBe(reason);
  });

  it('refuses writes inside WITH', () => {
    expect(rejected('WITH gone AS (SELECT 1) DELETE FROM t')).toBe(
      'A WITH query may only read; this one has DELETE, which changes data. If DELETE is a column name, put it in double quotes.',
    );
    expect(rejected('WITH a AS (SELECT 1) INSERT INTO t SELECT * FROM a')).toContain('this one has INSERT');
    expect(rejected('WITH a AS (SELECT 1) UPDATE t SET amount = 0')).toContain('this one has UPDATE');
    expect(rejected('WITH a AS (SELECT 1) REPLACE INTO t SELECT * FROM a')).toContain('this one has REPLACE');
    expect(rejected('WITH a AS (DELETE FROM t RETURNING *) SELECT * FROM a')).toContain('this one has DELETE');
  });

  it('refuses a WITH that does not end in a SELECT', () => {
    expect(rejected('WITH a AS (SELECT 1) VALUES (2)')).toBe('A WITH query must end in a SELECT that reads the rows it defines.');
    expect(rejected('WITH a AS (SELECT 1)')).toContain('must end in a SELECT');
  });

  it('refuses a second statement hidden after a comment', () => {
    expect(rejected('SELECT * FROM t WHERE 1 = 1 --\n; DROP TABLE t')).toContain('2 statements');
    expect(rejected("SELECT 'a' /* ' */; DROP TABLE t")).toContain('2 statements');
    expect(rejected('SELECT 1\nUNION SELECT 2 FROM t WHERE (vacuum)')).toContain('VACUUM is not allowed');
  });

  it('refuses text values and quoted names that never close', () => {
    expect(rejected("SELECT * FROM t WHERE code = 'A1")).toBe('A text value in single quotes is never closed.');
    expect(rejected('SELECT "amount FROM t')).toBe('A quoted name is never closed.');
    expect(rejected('SELECT [amount FROM t')).toBe('A quoted name is never closed.');
  });

  it('refuses an empty query', () => {
    for (const sql of ['', '   ', ';', ' ; ; ', '-- just a note', '/* nothing */']) {
      expect(rejected(sql)).toBe('The query is empty.');
    }
  });
});
