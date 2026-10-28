const NBSP = ' ';

/**
 * A duration as a reader says it: "340 ms", "8.4 s", "1 min 12 s". The number and its unit never
 * break apart across lines.
 */
export function formatDuration(ms: number): string {
  if (ms < 1) return `<1${NBSP}ms`;
  if (ms < 999.5) return `${Math.round(ms)}${NBSP}ms`;
  const tenths = Math.round(ms / 100);
  if (tenths < 600) return `${(tenths / 10).toFixed(1)}${NBSP}s`;
  const seconds = Math.round(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}${NBSP}min` : `${minutes}${NBSP}min ${rest}${NBSP}s`;
}
