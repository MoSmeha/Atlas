import { useState } from 'react';
import { Box, Button, Group, Popover, Stack, Text } from '@mantine/core';
import { IconChevronUp, IconEyeOff } from '@tabler/icons-react';
import type { FileKind } from '@atlas/shared';
import { useFolderStatus } from '../../api/useFolderStatus';
import { useRestoreToFolder } from '../../api/useRestoreToFolder';
import { useCopy } from '../../i18n/useCopy';
import { useLanguage } from '../../i18n/useLanguage';
import { notifyError } from '../errors/notifyError';
import { FileTypeIcon } from './FileTypeIcon';
import { FolderGlyph } from './FolderGlyph';
import { sidebarCopy } from './sidebarCopy';

/** Mantine's side padding for a compact-sm button. */
const BUTTON_INSET = 'var(--button-padding-x-compact-sm, 0.5rem)';

/** A removed path names a PDF or workbook by its extension; anything else was a folder. */
function kindOf(path: string): FileKind | 'folder' {
  if (/\.pdf$/i.test(path)) return 'pdf';
  if (/\.xls[xm]$/i.test(path)) return 'excel';
  return 'folder';
}

/**
 * "2 removed from Atlas" at the foot of the sidebar, for a folder loaded by its path. It opens the list of files and
 * folders taken out of Atlas, which stay on disk, each with Put back.
 */
export function RemovedLine() {
  const status = useFolderStatus();
  const { language } = useLanguage();
  const copy = useCopy(sidebarCopy);
  const restore = useRestoreToFolder();
  // Controlled, because Mantine closes on Escape only while focus is inside the dropdown.
  const [opened, setOpened] = useState(false);
  const removed = status.data?.removed ?? [];
  if (removed.length === 0) return null;

  return (
    <Box pt="xs" mt="xs" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
      <Popover opened={opened} onChange={setOpened} position="top-start" width="target" offset={6} withinPortal>
        <Popover.Target>
          {/* Pulled out by its own padding so the icon lines up with the file icons above. */}
          <Button
            onClick={() => setOpened((open) => !open)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpened(false);
            }}
            variant="subtle"
            color="gray"
            size="compact-sm"
            w={`calc(100% + 2 * ${BUTTON_INSET})`}
            mx={`calc(-1 * ${BUTTON_INSET})`}
            justify="space-between"
            rightSection={<IconChevronUp size={14} stroke={1.5} />}
            fw={400}
          >
            <Group component="span" gap="xs" wrap="nowrap">
              <IconEyeOff size={18} stroke={1.5} />
              {copy.removed(removed.length)}
            </Group>
          </Button>
        </Popover.Target>
        <Popover.Dropdown p="sm">
          <Text fz="sm" fw={600}>
            {copy.removedTitle}
          </Text>
          <Text fz="xs" c="dimmed" mb="xs">
            {copy.removedNote}
          </Text>
          <Stack component="ul" gap="xs" p={0} m={0} style={{ listStyle: 'none' }}>
            {removed.map((path) => {
              const kind = kindOf(path);
              const restoring = restore.isPending && restore.variables === path;
              return (
                <Group component="li" key={path} gap="xs" wrap="nowrap" justify="space-between">
                  <Group gap="xs" wrap="nowrap" miw={0}>
                    {kind === 'folder' ? <FolderGlyph open={false} size={16} /> : <FileTypeIcon kind={kind} size={16} />}
                    <Text fz="sm" lh="xs" dir="auto" style={{ overflowWrap: 'anywhere' }}>
                      {path}
                    </Text>
                  </Group>
                  <Button
                    variant="default"
                    size="compact-xs"
                    loading={restoring}
                    disabled={restore.isPending && !restoring}
                    aria-label={copy.putBackItem(path)}
                    onClick={() =>
                      restore.mutate(path, { onError: (error) => notifyError(error, copy.putBackFailed, language) })
                    }
                  >
                    {copy.putBack}
                  </Button>
                </Group>
              );
            })}
          </Stack>
        </Popover.Dropdown>
      </Popover>
    </Box>
  );
}
