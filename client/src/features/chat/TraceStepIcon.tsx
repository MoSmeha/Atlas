import { Loader } from '@mantine/core';
import { IconCheck, IconMinus, IconX } from '@tabler/icons-react';
import type { ToolStepStatus } from '@atlas/shared';

/** A step's state as the trace shows it: "unfinished" is a step still running when its answer stopped or failed. */
export type TraceStepState = ToolStepStatus | 'unfinished';

/** Each state, as words for screen readers. */
export const stepStateWords: Record<TraceStepState, string> = {
  running: 'Running',
  ok: 'Done',
  error: 'Failed',
  refused: 'Skipped',
  unfinished: 'Did not finish',
};

/** A step's state as a shape, so it reads without colour: a spinner, a check, a cross or a dash. */
export function TraceStepIcon({ status }: { status: TraceStepState }) {
  if (status === 'running') return <Loader size={12} color="gray.6" aria-hidden />;
  const Icon = status === 'ok' ? IconCheck : status === 'error' ? IconX : IconMinus;
  return <Icon size={12} stroke={2.25} aria-hidden />;
}
