import { Group, Loader, Text } from '@mantine/core';
import type { ToolStep } from '@atlas/shared';
import { pendingActivity } from './stepActivity';

/** What Atlas is doing before the first words of the answer arrive, e.g. "Searching the documents". */
export function PendingLine({ steps }: { steps: ToolStep[] }) {
  const { label, detail } = pendingActivity(steps);
  return (
    <Group gap="xs" wrap="nowrap" mih={24} aria-live="polite">
      <Loader type="dots" size="xs" color="gray.5" aria-hidden />
      <Text fz="sm" c="gray.7" style={{ flexShrink: 0 }}>
        {label}
      </Text>
      {detail && (
        <Text fz="sm" c="dimmed" truncate="end" miw={0} dir="auto">
          {detail}
        </Text>
      )}
    </Group>
  );
}
