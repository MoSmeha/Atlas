import { Stack, Text } from '@mantine/core';
import { useCopy } from '../../i18n/useCopy';
import { sidebarCopy } from './sidebarCopy';

/** What the register says when it has nothing to list, and what to do next. */
export function RegisterEmpty({ reason }: { reason: 'no-folder' | 'no-files' }) {
  const { title, body } = useCopy(sidebarCopy).empty[reason];
  return (
    <Stack gap={4} py="xs">
      <Text fz="sm" fw={600}>
        {title}
      </Text>
      <Text fz="sm" c="dimmed">
        {body}
      </Text>
    </Stack>
  );
}
