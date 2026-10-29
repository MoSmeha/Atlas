import { Group, Loader, Text } from '@mantine/core';
import type { ToolStep } from '@atlas/shared';
import { useLanguage } from '../../i18n/useLanguage';
import { pendingActivity } from './stepActivity';
import { stepInputDir } from './stepInput';

/** What Atlas is doing before the first words of the answer arrive, e.g. "Searching the documents". */
export function PendingLine({ steps }: { steps: ToolStep[] }) {
  const { language } = useLanguage();
  const { label, input } = pendingActivity(steps, language);
  return (
    <Group gap="xs" wrap="nowrap" mih={24} aria-live="polite">
      <Loader type="dots" size="xs" color="gray.5" aria-hidden />
      <Text fz="sm" c="gray.7" style={{ flexShrink: 0 }}>
        {label}
      </Text>
      {input && (
        <Text fz="sm" c="dimmed" truncate="end" miw={0} dir={stepInputDir(input)}>
          {input.text}
        </Text>
      )}
    </Group>
  );
}
