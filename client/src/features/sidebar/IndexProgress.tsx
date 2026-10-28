import { Collapse, Group, Progress, Stack, Text } from '@mantine/core';
import { useFolderStatus } from '../../api/useFolderStatus';
import type { IndexActivity } from '../../api/useIndexEvents';
import { motion } from '../../theme';
import { INDEX_STEP_COUNT, type IndexingNow, indexingNow } from './indexingNow';

/** Shown while the block closes after the last step, so it never collapses around stale text. */
const finished: IndexingNow = { label: 'Finished', step: INDEX_STEP_COUNT, message: 'All files read', percent: 100 };

/**
 * The indexing line under the dropzone: the step, a thin progress bar and "Reading X, 3 of 12".
 * It opens while a folder is indexed and closes when it is ready. A failed run leaves a line saying why.
 */
export function IndexProgress({ activity }: { activity: IndexActivity | null }) {
  const status = useFolderStatus();
  const now = indexingNow(status.data, activity);
  const shown = now ?? finished;
  const failure = status.data?.phase === 'error' ? status.data.error : null;

  return (
    <>
      <Collapse expanded={now !== null} transitionDuration={motion.durationMs} transitionTimingFunction={motion.easing}>
        <Stack gap={6} pt="xs">
          <Group justify="space-between" gap="xs" wrap="nowrap">
            <Text fz="sm" fw={600} aria-live="polite">
              {shown.label}
            </Text>
            <Text fz="xs" c="dimmed" className="tabular-nums" style={{ flexShrink: 0 }}>
              Step {shown.step} of {INDEX_STEP_COUNT}
            </Text>
          </Group>
          <Progress
            size={3}
            value={shown.percent ?? 100}
            animated={shown.percent === null}
            transitionDuration={motion.durationMs}
            aria-label={`${shown.label}, step ${shown.step} of ${INDEX_STEP_COUNT}`}
          />
          <Text fz="xs" c="dimmed" truncate="end" dir="auto" className="tabular-nums">
            {shown.message}
          </Text>
        </Stack>
      </Collapse>
      {failure !== null && (
        <Text role="alert" fz="xs" lh="sm" pt="xs" c="var(--mantine-color-error)">
          Indexing stopped. {failure.message}
        </Text>
      )}
    </>
  );
}
