import { Group, Skeleton, Stack } from '@mantine/core';
import { useCopy } from '../../i18n/useCopy';
import { sidebarCopy } from './sidebarCopy';

/** Name widths that vary like real file names. */
const widths = ['78%', '62%', '86%', '54%', '70%', '66%'];

/** Placeholder rows in the shape of the folder tree while its first status loads: a root, then nested files. */
export function RegisterSkeleton({ rows = 6 }: { rows?: number }) {
  const copy = useCopy(sidebarCopy);
  return (
    <Stack gap={0} aria-busy="true" aria-label={copy.loadingDocuments}>
      <Group gap={6} wrap="nowrap" py={6} ps={4}>
        <Skeleton height={14} width={14} radius="sm" />
        <Skeleton height={12} width="42%" radius="sm" />
      </Group>
      {Array.from({ length: rows }, (_, i) => (
        <Group key={i} gap="xs" wrap="nowrap" align="flex-start" py={6} ps={24}>
          <Skeleton height={16} width={16} radius="sm" />
          <Stack gap={6} flex={1} pt={2}>
            <Skeleton height={12} width={widths[i % widths.length]} radius="sm" />
            <Skeleton height={10} width="34%" radius="sm" />
          </Stack>
        </Group>
      ))}
    </Stack>
  );
}
