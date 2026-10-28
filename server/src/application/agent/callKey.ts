/** Identifies a tool call by its name and arguments, whatever the key order, so repeats can be spotted. */
export function callKey(tool: string, args: unknown): string {
  return `${tool} ${JSON.stringify(sortKeys(args))}`;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value === null || typeof value !== 'object') return value;
  const entries = Object.entries(value).toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return Object.fromEntries(entries.map(([key, inner]) => [key, sortKeys(inner)]));
}
