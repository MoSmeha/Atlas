import { Group, Skeleton, Stack } from '@mantine/core';

/** Name widths that vary like real file names. */
const widths = ['78%', '62%', '86%', '54%', '70%', '66%'];

/** Placeholder rows in the shape of the register while its first status loads. */
export function RegisterSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Stack gap={0} aria-busy="true" aria-label="Loading documents">
      {Array.from({ length: rows }, (_, i) => (
        <Group key={i} gap="xs" wrap="nowrap" align="flex-start" py={6}>
          <Skeleton height={18} width={18} radius="sm" />
          <Stack gap={6} flex={1} pt={2}>
            <Skeleton height={12} width={widths[i % widths.length]} radius="sm" />
            <Skeleton height={10} width="34%" radius="sm" />
          </Stack>
        </Group>
      ))}
    </Stack>
  );
}
