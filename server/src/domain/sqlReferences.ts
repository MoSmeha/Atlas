import { tokenizeSql } from './sqlTokens';

export interface SqlReferences {
  /** Bare words and quoted names, lower case, in order of first use, without repeats. Strings and comments are skipped. */
  names: string[];
  /** Names used as a function call, such as sum in sum(amount), lower case, without repeats. */
  calls: string[];
}

/** The names a query uses, so callers can tell which tables it reads and which columns and functions it touches. */
export function sqlReferences(sql: string): SqlReferences {
  const tokens = tokenizeSql(sql).filter((token) => token.kind !== 'space' && token.kind !== 'comment');
  const names = new Set<string>();
  const calls = new Set<string>();
  tokens.forEach((token, i) => {
    if (token.kind !== 'word' && token.kind !== 'identifier') return;
    const name = token.value.toLowerCase();
    names.add(name);
    const next = tokens[i + 1];
    if (next?.kind === 'symbol' && next.text === '(') calls.add(name);
  });
  return { names: [...names], calls: [...calls] };
}
