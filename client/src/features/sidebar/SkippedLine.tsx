import { useState } from 'react';
import { Box, Button, Group, Popover, Stack, Text } from '@mantine/core';
import { IconChevronUp, IconFileOff } from '@tabler/icons-react';
import { useFolderStatus } from '../../api/useFolderStatus';
import { FileTypeIcon } from './FileTypeIcon';
import { statusLook } from './fileStatus';

/** Mantine's side padding for a compact-sm button. */
const BUTTON_INSET = 'var(--button-padding-x-compact-sm, 0.5rem)';

/** "1 file skipped" at the foot of the sidebar; it opens a list of the files Atlas did not read, and why. */
export function SkippedLine() {
  const status = useFolderStatus();
  // Controlled, because Mantine closes on Escape only while focus is inside the dropdown.
  const [opened, setOpened] = useState(false);
  const skipped = status.data?.documents.filter((document) => document.status === 'skipped') ?? [];
  if (skipped.length === 0) return null;
  const fallback = statusLook('skipped')?.detail ?? null;

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
              <IconFileOff size={18} stroke={1.5} />
              {skipped.length} {skipped.length === 1 ? 'file' : 'files'} skipped
            </Group>
          </Button>
        </Popover.Target>
        <Popover.Dropdown p="sm">
          <Text fz="sm" fw={600}>
            Not read
          </Text>
          <Text fz="xs" c="dimmed" mb="xs">
            Atlas reads PDF and Excel files only.
          </Text>
          <Stack component="ul" gap="xs" p={0} m={0} style={{ listStyle: 'none' }}>
            {skipped.map((document) => (
              <Group component="li" key={document.id} gap="xs" wrap="nowrap" align="flex-start">
                <FileTypeIcon kind={document.kind} size={16} />
                <Stack gap={2} miw={0}>
                  <Text fz="sm" lh="xs" style={{ overflowWrap: 'anywhere' }}>
                    {document.name}
                  </Text>
                  <Text fz="xs" c="dimmed">
                    {document.statusDetail ?? fallback}
                  </Text>
                </Stack>
              </Group>
            ))}
          </Stack>
        </Popover.Dropdown>
      </Popover>
    </Box>
  );
}
