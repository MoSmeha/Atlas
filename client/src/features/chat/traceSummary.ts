import type { ToolStep } from '@atlas/shared';
import { formatDuration } from './formatDuration';

/**
 * The trace's one-line summary: "5 steps, 8.4 s" under an answer, with the time the whole answer
 * took; "2 steps so far" while it streams; "3 steps" when it stopped or failed before an answer.
 */
export function traceSummary(steps: ToolStep[], streaming: boolean, durationMs: number | null): string {
  const count = `${steps.length} ${steps.length === 1 ? 'step' : 'steps'}`;
  if (streaming) return `${count} so far`;
  return durationMs === null ? count : `${count}, ${formatDuration(durationMs)}`;
}
