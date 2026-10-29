import { Collapse, Group, Progress, Stack, Text } from '@mantine/core';
import { useFolderStatus } from '../../api/useFolderStatus';
import type { IndexActivity } from '../../api/useIndexEvents';
import { useCopy } from '../../i18n/useCopy';
import { useLanguage } from '../../i18n/useLanguage';
import { motion } from '../../theme';
import { errorMessage } from '../errors/errorCopy';
import { INDEX_STEP_COUNT, type IndexingNow, indexingNow } from './indexingNow';
import { sidebarCopy } from './sidebarCopy';

/**
 * The indexing line under the dropzone: the step, a thin progress bar and "Reading X, 3 of 12".
 * It opens while a folder is indexed and closes when it is ready. A failed run leaves a line saying why.
 */
export function IndexProgress({ activity }: { activity: IndexActivity | null }) {
  const status = useFolderStatus();
  const { language } = useLanguage();
  const copy = useCopy(sidebarCopy);
  const now = indexingNow(status.data, activity, copy, language === 'en');
  // Shown while the block closes after the last step, so it never collapses around stale text.
  const finished: IndexingNow = { label: copy.finished, step: INDEX_STEP_COUNT, message: copy.allRead, percent: 100 };
  const shown = now ?? finished;
  // A folder with no PDF or Excel files never started indexing; the folder form and the main column say so.
  const error = status.data?.phase === 'error' ? status.data.error : null;
  const failure = error?.code === 'folder_empty' ? null : error;
  const stepText = copy.stepOf(shown.step, INDEX_STEP_COUNT);

  return (
    <>
      <Collapse expanded={now !== null} transitionDuration={motion.durationMs} transitionTimingFunction={motion.easing}>
        <Stack gap={6} pt="xs">
          <Group justify="space-between" gap="xs" wrap="nowrap">
            <Text fz="sm" fw={600} aria-live="polite">
              {shown.label}
            </Text>
            <Text fz="xs" c="dimmed" className="tabular-nums" style={{ flexShrink: 0 }}>
              {stepText}
            </Text>
          </Group>
          <Progress
            size={3}
            value={shown.percent ?? 100}
            animated={shown.percent === null}
            transitionDuration={motion.durationMs}
            aria-label={`${shown.label}${copy.listSeparator}${stepText}`}
          />
          <Text fz="xs" c="dimmed" truncate="end" className="tabular-nums">
            {shown.message}
          </Text>
        </Stack>
      </Collapse>
      {failure !== null && (
        <Text role="alert" fz="xs" lh="sm" pt="xs" c="var(--mantine-color-error)">
          {copy.indexingStopped} {errorMessage(failure, language)}
        </Text>
      )}
    </>
  );
}
