/** Sheet rows from one to another, both included, numbered as Excel shows them. */
export interface RowRange {
  from: number;
  to: number;
}

/**
 * Groups cited sheet rows into ranges for sources. Two cited rows share a range when they are next to each
 * other, or when both are rows of the table and no other table row lies between them, so blank and heading
 * rows the table skips do not split a range, while an uncited row (a total, say) does.
 */
export function rowRanges(cited: readonly number[], tableRows: readonly number[]): RowRange[] {
  const rows = [...new Set(cited)].sort((a, b) => a - b);
  const table = [...new Set(tableRows)].sort((a, b) => a - b);
  const inTable = new Set(table);
  const ranges: RowRange[] = [];
  /** Index of the first table row after the end of the current range. */
  let after = 0;
  for (const row of rows) {
    const last = ranges.at(-1);
    if (!last) {
      ranges.push({ from: row, to: row });
      continue;
    }
    while (after < table.length && (table[after] ?? 0) <= last.to) after += 1;
    const nothingBetween = (table[after] ?? Infinity) >= row;
    if (row === last.to + 1 || (inTable.has(last.to) && inTable.has(row) && nothingBetween)) last.to = row;
    else ranges.push({ from: row, to: row });
  }
  return ranges;
}
