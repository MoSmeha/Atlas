import { sliceText } from '../../domain/text';

export const MAX_SUMMARY_CHARS = 140;

/**
 * Tool arguments as one compact line for the trace and the logs: JSON without the null (unused)
 * fields, cut to about 140 characters. Raw text, such as arguments that were not valid JSON, is shown
 * as it is. No arguments at all gives an empty string.
 */
export function inputSummary(args: unknown): string {
  const text = typeof args === 'string' ? args : (JSON.stringify(withoutNulls(args)) ?? '');
  const line = text.replace(/\s+/g, ' ').trim();
  if (line === '{}') return '';
  return line.length <= MAX_SUMMARY_CHARS ? line : `${sliceText(line, MAX_SUMMARY_CHARS - 1).trimEnd()}…`;
}

function withoutNulls(args: unknown): unknown {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return args;
  return Object.fromEntries(Object.entries(args).filter(([, value]) => value !== null));
}
