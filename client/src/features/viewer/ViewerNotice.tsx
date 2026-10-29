import type { ReactNode } from 'react';
import { Box } from '@mantine/core';

/** A notice in place of the page or sheet, at a readable width. */
export function ViewerNotice({ children }: { children: ReactNode }) {
  return (
    <Box p="lg" maw={600}>
      {children}
    </Box>
  );
}
