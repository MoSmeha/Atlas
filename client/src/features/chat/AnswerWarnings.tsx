import { Group, Stack, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useCopy } from '../../i18n/useCopy';
import { chatCopy } from './chatCopy';

/**
 * Notes the answer checks left, such as a number no tool returned. Nothing when there are none. The server writes
 * them, so each keeps its own direction.
 */
export function AnswerWarnings({ warnings }: { warnings: string[] }) {
  const copy = useCopy(chatCopy).answer;
  if (warnings.length === 0) return null;
  return (
    <Stack gap={6} role="note" aria-label={copy.warnings}>
      {warnings.map((warning) => (
        <Group key={warning} gap="xs" align="flex-start" wrap="nowrap">
          <IconAlertTriangle size={16} stroke={1.75} color="var(--mantine-color-yellow-7)" aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
          <Text fz="sm" c="gray.8" dir="auto">
            {warning}
          </Text>
        </Group>
      ))}
    </Stack>
  );
}
