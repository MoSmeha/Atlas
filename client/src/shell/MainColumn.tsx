import type { ReactNode } from 'react';
import { Box, Stack } from '@mantine/core';
import { shellLayout } from './layout';

interface MainColumnProps {
  /** The conversation: the empty state first, then one turn per question. */
  children: ReactNode;
  /** The question box, docked to the bottom of the column. Null while the empty state holds it. */
  composer: ReactNode;
}

/** The centred 760px reading column. The sheet scrolls; the composer stays at its bottom edge. */
export function MainColumn({ children, composer }: MainColumnProps) {
  return (
    <Stack
      gap={0}
      w="100%"
      maw={`calc(${shellLayout.columnWidth}px + 2 * var(--mantine-spacing-md))`}
      mx="auto"
      px="md"
      mih="100%"
    >
      <Stack flex={1} gap="lg" pt="xl" pb="lg">
        {children}
      </Stack>
      {composer !== null && (
        <Box pos="sticky" bottom={0} pb="md" bg="var(--mantine-color-body)">
          {composer}
        </Box>
      )}
    </Stack>
  );
}
