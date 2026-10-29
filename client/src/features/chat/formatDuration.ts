import type { Language } from '../../i18n/language';
import { traceCopy } from './traceCopy';

const NBSP = ' ';

/**
 * A duration as a reader says it: "340 ms", "8.4 s", "1 min 12 s" (in Arabic "8.4 ث", "1 د 12 ث"). The number
 * and its unit never break apart across lines.
 */
export function formatDuration(ms: number, language: Language = 'en'): string {
  const { units } = traceCopy[language];
  if (ms < 1) return `<1${NBSP}${units.ms}`;
  if (ms < 999.5) return `${Math.round(ms)}${NBSP}${units.ms}`;
  const tenths = Math.round(ms / 100);
  if (tenths < 600) return `${(tenths / 10).toFixed(1)}${NBSP}${units.s}`;
  const seconds = Math.round(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}${NBSP}${units.min}` : `${minutes}${NBSP}${units.min} ${rest}${NBSP}${units.s}`;
}
