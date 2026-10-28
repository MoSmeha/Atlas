/** Wraps a table or column name in double quotes for SQL, doubling any quote inside it. */
export function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}
