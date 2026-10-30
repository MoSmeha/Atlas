import type { IndexPhase, IndexProgress, IndexStatus } from '@atlas/shared';
import type { IndexActivity } from '../../api/useIndexEvents';
import type { SidebarCopy } from './sidebarCopy';

type ActivePhase = Extract<IndexPhase, 'scanning' | 'reading' | 'embedding' | 'classifying'>;

/** The four indexing steps in order. */
const steps: readonly ActivePhase[] = ['scanning', 'reading', 'embedding', 'classifying'];

export const INDEX_STEP_COUNT = steps.length;

export interface IndexingNow {
  label: string;
  /** 1 to INDEX_STEP_COUNT. */
  step: number;
  /** "Reading BOQ_Phase2.xlsx, 3 of 12". */
  message: string;
  /** Percent through this step, or null when the total is not known yet. */
  percent: number | null;
}

/** True while a folder is being indexed. */
export function isIndexing(phase: IndexPhase): phase is ActivePhase {
  return (steps as readonly IndexPhase[]).includes(phase);
}

/**
 * What indexing is doing right now, or null when it is not running. The folder status decides
 * whether it runs, since it is refetched after every event and after a reconnect; the event
 * stream, which is newer, supplies the step and line while it reports a running step. The server's
 * line is English, so in Arabic the step's own line and the count stand in for it.
 */
export function indexingNow(
  status: IndexStatus | undefined,
  activity: IndexActivity | null,
  copy: SidebarCopy,
  english: boolean,
): IndexingNow | null {
  const running = runningStep(status, activity);
  if (running === null) return null;

  const { phase, progress } = running;
  const percent = progress !== null && progress.total > 0 ? Math.min(100, (progress.current / progress.total) * 100) : null;
  const { label, waiting } = copy.steps[phase];
  let message = waiting;
  if (english && progress?.message) message = progress.message;
  else if (progress !== null && progress.total > 0) message = `${waiting}${copy.listSeparator}${copy.progressOf(progress.current, progress.total)}`;
  return { label, step: steps.indexOf(phase) + 1, message, percent };
}

function runningStep(
  status: IndexStatus | undefined,
  activity: IndexActivity | null,
): { phase: ActivePhase; progress: IndexProgress | null } | null {
  if (status === undefined || !isIndexing(status.phase)) return null;
  if (activity !== null && isIndexing(activity.phase)) return { phase: activity.phase, progress: activity.progress };
  return { phase: status.phase, progress: status.progress };
}
