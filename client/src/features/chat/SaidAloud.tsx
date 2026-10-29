import { Group, Stack, Text } from '@mantine/core';
import { IconVolume } from '@tabler/icons-react';

/**
 * What Atlas said aloud about a spoken question's answer, as the call transcribed it. The written answer above stays
 * the record; this shows what the voice made of it, so the two can be compared.
 */
export function SaidAloud({ text }: { text: string }) {
  const said = text.replace(/\s+/g, ' ').trim();
  if (said === '') return null;
  return (
    <Group gap={8} wrap="nowrap" align="flex-start">
      <IconVolume size={14} stroke={1.75} color="var(--mantine-color-dimmed)" style={{ flex: 'none', marginTop: 2 }} aria-hidden />
      <Stack gap={2} miw={0}>
        <Text fz="xs" fw={600} c="dimmed">
          Said aloud
        </Text>
        <Text fz="sm" c="gray.8" dir="auto" style={{ unicodeBidi: 'plaintext', overflowWrap: 'anywhere' }}>
          {said}
        </Text>
      </Stack>
    </Group>
  );
}
