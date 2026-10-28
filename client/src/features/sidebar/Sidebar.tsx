import { AppShell, Stack } from '@mantine/core';
import type { IndexActivity } from '../../api/useIndexEvents';
import { DocumentRegister } from './DocumentRegister';
import { FolderForm } from './FolderForm';
import { IndexProgress } from './IndexProgress';
import { SkippedLine } from './SkippedLine';
import { UploadDrop } from './UploadDrop';

interface SidebarProps {
  /** Live indexing step from useIndexEvents, mounted once in App. */
  activity: IndexActivity | null;
}

/**
 * The left sidebar inside AppShell.Navbar: folder path and dropzone at the top, the indexing
 * line while a folder loads, the scrolling document register, and the skipped files at the foot.
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
        <SkippedLine />
      </AppShell.Section>
    </>
  );
}
