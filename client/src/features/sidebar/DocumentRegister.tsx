import type { ReactNode } from 'react';
import { Button, ScrollArea, Stack, Text } from '@mantine/core';
import { useFolderStatus } from '../../api/useFolderStatus';
import { useCopy } from '../../i18n/useCopy';
import { useLanguage } from '../../i18n/useLanguage';
import { errorMessage } from '../errors/errorCopy';
import { folderName } from './folderPath';
import { buildFolderTree } from './buildFolderTree';
import { FolderTree } from './FolderTree';
import { isIndexing } from './indexingNow';
import { RegisterEmpty } from './RegisterEmpty';
import { RegisterSkeleton } from './RegisterSkeleton';
import { sidebarCopy } from './sidebarCopy';

/**
 * Every PDF and Excel file in the loaded folder under a "Documents" heading, as a folder tree in
 * the server's order. Files of other types are left to the skipped line at the foot. Fills the
 * height it is given and scrolls.
 */
export function DocumentRegister() {
  const status = useFolderStatus();
  const { language } = useLanguage();
  const copy = useCopy(sidebarCopy);
  const listed = status.data?.documents.filter((document) => document.status !== 'skipped') ?? [];

  let body: ReactNode;
  if (status.isPending) {
    body = <RegisterSkeleton />;
  } else if (status.data === undefined) {
    // A failed refetch keeps the last list on screen; only a first load that failed lands here.
    body = (
      <Stack gap="xs" align="flex-start" py="xs">
        <Text role="alert" fz="sm" c="var(--mantine-color-error)">
          {errorMessage(status.error, language)}
        </Text>
        <Button variant="default" size="xs" loading={status.isFetching} onClick={() => void status.refetch()}>
          {copy.tryAgain}
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
    body = <FolderTree root={buildFolderTree(folderName(status.data.folder ?? ''), listed)} />;
  }

  return (
    <Stack gap={6} flex={1} mih={0} miw={0}>
      <Text component="h2" fz="sm" fw={600} m={0}>
        {copy.documents}
      </Text>
      {/* type="auto" keeps the scrollbar showing whenever the list runs past the sidebar, so it reads as more below. */}
      <ScrollArea type="auto" flex={1} mih={0} mx="calc(var(--mantine-spacing-md) * -1)" px="md" scrollbars="y">
        {body}
      </ScrollArea>
    </Stack>
  );
}
