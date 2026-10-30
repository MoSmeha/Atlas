import { AppShell, Box, Stack } from '@mantine/core';
import type { IndexActivity } from '../../api/useIndexEvents';
import { Preferences } from '../topbar/Preferences';
import { DocumentRegister } from './DocumentRegister';
import { FolderForm } from './FolderForm';
import { IndexProgress } from './IndexProgress';
import { RemovedLine } from './RemovedLine';
import { SkippedLine } from './SkippedLine';
import { UploadDrop } from './UploadDrop';

interface SidebarProps {
  /** Live indexing step from useIndexEvents, mounted once in App. */
  activity: IndexActivity | null;
}

/**
 * The left sidebar inside AppShell.Navbar: folder path and dropzone at the top, the indexing
 * line while a folder loads, the scrolling folder tree, and the removed and skipped files at the foot. On a
 * phone the foot also holds the language and theme, which the top bar has no room for.
 */
export function Sidebar({ activity }: SidebarProps) {
  return (
    <>
      <AppShell.Section>
        <Stack gap="sm">
          <FolderForm />
          <UploadDrop />
        </Stack>
        <IndexProgress activity={activity} />
      </AppShell.Section>
      <AppShell.Section grow display="flex" mih={0} pt="lg">
        <DocumentRegister />
      </AppShell.Section>
      <AppShell.Section>
        <RemovedLine />
        <SkippedLine />
        <Box hiddenFrom="sm" pt="xs" mt="xs" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
          <Preferences />
        </Box>
      </AppShell.Section>
    </>
  );
}
