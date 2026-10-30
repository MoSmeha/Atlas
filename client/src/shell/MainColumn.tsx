import type { ReactNode } from 'react';
import { Box, Stack } from '@mantine/core';
import { shellLayout } from './layout';
import classes from './MainColumn.module.css';

interface MainColumnProps {
  /** The conversation: Atlas's opening first, then one turn per question. */
  children: ReactNode;
  /** The question box, or the call card during a call, docked to the bottom of the column. */
  composer: ReactNode;
  /** The box waits unseen below the sheet's foot until the opening has said its line, then rises into place. */
  composerWaiting?: boolean;
}

/** The centred 760px reading column. The sheet scrolls; the composer stays at its bottom edge. */
export function MainColumn({ children, composer, composerWaiting = false }: MainColumnProps) {
  return (
    <Stack
      className={classes.column}
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
      <Box className={classes.dock} data-waiting={composerWaiting || undefined}>
        {composer}
      </Box>
    </Stack>
  );
}
