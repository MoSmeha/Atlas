import { describe, expect, it } from 'vitest';
import { tokenizeSql } from '../../src/domain/sqlTokens';

function kinds(sql: string): string[] {
  return tokenizeSql(sql)
    .filter((token) => token.kind !== 'space')
    .map((token) => `${token.kind}:${token.value}`);
}

describe('tokenizeSql', () => {
  it('splits words, symbols and spaces, keeping the text exactly', () => {
    const sql = 'SELECT sum(amount) FROM t_boq\nWHERE _is_total = 0;';
    expect(kinds(sql)).toEqual([
      'word:SELECT',
      'word:sum',
      'symbol:(',
      'word:amount',
      'symbol:)',
      'word:FROM',
      'word:t_boq',
      'word:WHERE',
      'word:_is_total',
      'symbol:=',
      'word:0',
      'symbol:;',
    ]);
    expect(tokenizeSql(sql).map((token) => token.text).join('')).toBe(sql);
  });

  it('reads a string with doubled quotes as one token', () => {
    const [, , string] = tokenizeSql("SELECT 'it''s; -- not a comment'");
    expect(string).toEqual({ kind: 'string', text: "'it''s; -- not a comment'", value: "it's; -- not a comment", closed: true });
  });

  it('reads names in double quotes, backticks and brackets', () => {
    expect(kinds('SELECT "Unit ""Rate""", `drop`, [delete] FROM t')).toEqual([
      'word:SELECT',
      'identifier:Unit "Rate"',
      'symbol:,',
      'identifier:drop',
      'symbol:,',
      'identifier:delete',
      'word:FROM',
      'word:t',
    ]);
  });

  it('reads line and block comments, stopping a line comment at the line end', () => {
    expect(kinds('SELECT 1 -- DROP TABLE t\n/* ; */ FROM t')).toEqual([
      'word:SELECT',
      'word:1',
      'comment:-- DROP TABLE t',
      'comment:/* ; */',
      'word:FROM',
      'word:t',
    ]);
  });

  it('marks a string, name or block comment that never closes', () => {
    expect(tokenizeSql("SELECT 'open").at(-1)).toMatchObject({ kind: 'string', closed: false });
    expect(tokenizeSql('SELECT "open').at(-1)).toMatchObject({ kind: 'identifier', closed: false });
    expect(tokenizeSql('SELECT [open').at(-1)).toMatchObject({ kind: 'identifier', closed: false });
    expect(tokenizeSql('SELECT 1 /* open').at(-1)).toMatchObject({ kind: 'comment', closed: false });
  });

  it('treats a comment between letters as a break, as SQLite does', () => {
    expect(kinds('SEL/**/ECT')).toEqual(['word:SEL', 'comment:/**/', 'word:ECT']);
  });

  it('counts characters above U+007F as word characters, as SQLite does', () => {
    expect(kinds('SELECT البند FROM t')).toEqual(['word:SELECT', 'word:البند', 'word:FROM', 'word:t']);
    expect(kinds('SELECT drop x')).toEqual(['word:SELECT', 'word:drop x']);
  });

  it('returns nothing for empty text', () => {
    expect(tokenizeSql('')).toEqual([]);
  });
});
