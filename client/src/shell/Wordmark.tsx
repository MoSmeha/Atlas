import { Text } from '@mantine/core';

/** The "Atlas" name in the top bar. Neutral ink: brand colour is reserved for actions. */
export function Wordmark() {
  return (
    <Text component="span" fz="lg" fw={700} lts="-0.015em" c="bright" lh={1}>
      Atlas
    </Text>
  );
}
