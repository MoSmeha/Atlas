import { Loader } from '@mantine/core';
import { IconCheck, IconMinus, IconX } from '@tabler/icons-react';
import type { ToolStepStatus } from '@atlas/shared';

/** Each state, as words for screen readers. */
export const stepStateWords: Record<ToolStepStatus, string> = {
  running: 'Running',
  ok: 'Done',
  error: 'Failed',
  refused: 'Skipped',
};

/** A step's state as a shape, so it reads without colour: a spinner, a check, a cross or a dash. */
export function TraceStepIcon({ status }: { status: ToolStepStatus }) {
  if (status === 'running') return <Loader size={12} color="gray.6" aria-hidden />;
  const Icon = status === 'ok' ? IconCheck : status === 'error' ? IconX : IconMinus;
  return <Icon size={12} stroke={2.25} aria-hidden />;
}
