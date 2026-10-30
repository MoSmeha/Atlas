import { Group, Text } from '@mantine/core';

/**
 * Atlas's mark and name in the top bar: a folded map of three panels, the middle one in the fold's
 * shade. Neutral ink, like the name: brand colour is reserved for actions. The name stays Latin in Arabic.
 */
export function Wordmark() {
  return (
    <Group gap={8} wrap="nowrap" c="bright" lang="en" dir="ltr">
      <svg width={20} height={20} viewBox="0 0 20 20" fill="currentColor" aria-hidden focusable="false">
        <path d="M2 4.6 7 2.5v13l-5 2.1z" />
        <path d="M7.6 2.6 12.4 4.6v13l-4.8-2z" opacity={0.42} />
        <path d="M13 4.6 18 2.5v13L13 17.6z" />
      </svg>
      <Text component="span" fz="lg" fw={700} lts="-0.015em" c="inherit" lh={1}>
        Atlas
      </Text>
    </Group>
  );
}
