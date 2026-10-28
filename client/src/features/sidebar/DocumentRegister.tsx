import type { ReactNode } from 'react';
import { Button, Group, ScrollArea, Stack, Text } from '@mantine/core';
import { useFolderStatus } from '../../api/useFolderStatus';
import { DocumentRow } from './DocumentRow';
import { isIndexing } from './indexingNow';
import { RegisterEmpty } from './RegisterEmpty';
import { RegisterSkeleton } from './RegisterSkeleton';

/**
 * Every PDF and Excel file in the loaded folder, one row each, in the server's order, under a
 * "Documents" heading with the count. Files of other types are left to the skipped line at the
 * foot. Fills the height it is given and scrolls.
 */
export function DocumentRegister() {
  const status = useFolderStatus();
  const listed = status.data?.documents.filter((document) => document.status !== 'skipped') ?? [];

  let body: ReactNode;
  if (status.isPending) {
    body = <RegisterSkeleton />;
  } else if (status.data === undefined) {
    // A failed refetch keeps the last list on screen; only a first load that failed lands here.
    body = (
      <Stack gap="xs" align="flex-start" py="xs">
        <Text role="alert" fz="sm" c="var(--mantine-color-error)">
          {status.error.message}
        </Text>
        <Button variant="default" size="xs" loading={status.isFetching} onClick={() => void status.refetch()}>
          Try again
        </Button>
      </Stack>
    );
  } else if (listed.length === 0) {
    body = isIndexing(status.data.phase) ? (
      <RegisterSkeleton rows={3} />
    ) : (
      <RegisterEmpty reason={status.data.folder === null ? 'no-folder' : 'no-files'} />
    );
  } else {
    body = (
      <Stack component="ul" gap={0} p={0} m={0} style={{ listStyle: 'none' }} aria-label="Documents">
        {listed.map((document) => (
          <DocumentRow key={document.id} document={document} />
        ))}
      </Stack>
    );
  }

  return (
    <Stack gap={4} flex={1} mih={0}>
      <Group justify="space-between" gap="xs" wrap="nowrap">
        <Text component="h2" fz="sm" fw={600} m={0}>
          Documents
        </Text>
        {listed.length > 0 && (
          <Text fz="xs" c="dimmed" className="tabular-nums">
            {listed.length.toLocaleString('en-US')} {listed.length === 1 ? 'file' : 'files'}
          </Text>
        )}
      </Group>
      <ScrollArea flex={1} mih={0} mx="calc(var(--mantine-spacing-md) * -1)" px="md">
        {body}
      </ScrollArea>
    </Stack>
  );
}
