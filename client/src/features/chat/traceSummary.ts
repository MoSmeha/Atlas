import type { ToolStep } from '@atlas/shared';
import type { Language } from '../../i18n/language';
import { formatDuration } from './formatDuration';
import { traceCopy } from './traceCopy';

/**
 * The trace's one-line summary: "5 steps, 8.4 s" under an answer, with the time the whole answer
 * took; "2 steps so far" while it streams; "3 steps" when it stopped or failed before an answer.
 */
export function traceSummary(
  steps: ToolStep[],
  streaming: boolean,
  durationMs: number | null,
  language: Language = 'en',
): string {
  const copy = traceCopy[language];
  const count = copy.steps(steps.length);
  if (streaming) return copy.soFar(count);
  return durationMs === null ? count : copy.took(count, formatDuration(durationMs, language));
}
