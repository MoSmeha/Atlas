import { Button, Group, Popover, Stack, Text } from '@mantine/core';
import { IconChevronUp, IconFileOff } from '@tabler/icons-react';
import { useFolderStatus } from '../../api/useFolderStatus';
import { FileTypeIcon } from './FileTypeIcon';
import { statusLook } from './fileStatus';

/** "1 file skipped" at the foot of the sidebar; it opens a list of the files Atlas did not read, and why. */
export function SkippedLine() {
  const status = useFolderStatus();
  const skipped = status.data?.documents.filter((document) => document.status === 'skipped') ?? [];
  if (skipped.length === 0) return null;
  const fallback = statusLook('skipped')?.detail ?? null;

  return (
    <Popover position="top-start" width="target" offset={6} withinPortal>
      <Popover.Target>
        <Button
          variant="subtle"
          color="gray"
          size="compact-sm"
          fullWidth
          justify="space-between"
          leftSection={<IconFileOff size={14} stroke={1.5} />}
          rightSection={<IconChevronUp size={14} stroke={1.5} />}
          fw={400}
        >
          {skipped.length} {skipped.length === 1 ? 'file' : 'files'} skipped
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
  );
}
