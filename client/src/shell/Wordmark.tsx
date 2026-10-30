import { Group, Text } from '@mantine/core';
import { AtlasMark } from './AtlasMark';

/**
 * Atlas's mark and name in the top bar: a spreadsheet and a PDF behind Atlas's face. The files take neutral ink, like
 * the name: brand colour is reserved for actions. The name stays Latin in Arabic.
 */
export function Wordmark() {
  return (
    <Group gap={8} wrap="nowrap" c="bright" lang="en" dir="ltr">
      <AtlasMark />
      <Text component="span" fz="lg" fw={700} lts="-0.015em" c="inherit" lh={1}>
        Atlas
      </Text>
    </Group>
  );
}
