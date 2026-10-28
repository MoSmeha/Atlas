import type { IndexPhase, IndexProgress, IndexStatus } from '@atlas/shared';
import type { IndexActivity } from '../../api/useIndexEvents';

type ActivePhase = Extract<IndexPhase, 'scanning' | 'reading' | 'embedding' | 'classifying'>;

/** The four indexing steps in order, with a plain label and a line for when no progress has arrived yet. */
const steps: Record<ActivePhase, { label: string; waiting: string }> = {
  scanning: { label: 'Finding files', waiting: 'Looking for PDF and Excel files' },
  reading: { label: 'Reading files', waiting: 'Opening the files' },
  embedding: { label: 'Preparing search', waiting: 'Preparing search over the text' },
  classifying: { label: 'Sorting by document type', waiting: 'Sorting the documents by type' },
};

export const INDEX_STEP_COUNT = Object.keys(steps).length;

export interface IndexingNow {
  label: string;
  /** 1 to INDEX_STEP_COUNT. */
  step: number;
  /** "Reading BOQ_Phase2.xlsx, 3 of 12". */
  message: string;
  /** Percent through this step, or null when the total is not known yet. */
  percent: number | null;
}

function isActive(phase: IndexPhase): phase is ActivePhase {
  return phase in steps;
}

/**
 * What indexing is doing right now, or null when it is not running. The folder status decides
 * whether it runs, since it is refetched after every event and after a reconnect; the event
 * stream, which is newer, supplies the step and line while it reports a running step.
 */
export function indexingNow(status: IndexStatus | undefined, activity: IndexActivity | null): IndexingNow | null {
  const running = runningStep(status, activity);
  if (running === null) return null;

  const { phase, progress } = running;
  const percent = progress !== null && progress.total > 0 ? Math.min(100, (progress.current / progress.total) * 100) : null;
  return {
    label: steps[phase].label,
    step: Object.keys(steps).indexOf(phase) + 1,
    message: progress?.message || steps[phase].waiting,
    percent,
  };
}

function runningStep(
  status: IndexStatus | undefined,
  activity: IndexActivity | null,
): { phase: ActivePhase; progress: IndexProgress | null } | null {
  if (status === undefined || !isActive(status.phase)) return null;
  if (activity !== null && isActive(activity.phase)) return { phase: activity.phase, progress: activity.progress };
  return { phase: status.phase, progress: status.progress };
}
