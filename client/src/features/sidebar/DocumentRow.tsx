import type { DocumentSummary } from '@atlas/shared';
import { Badge, Group, Stack, Text, Tooltip } from '@mantine/core';
import classes from './arrive.module.css';
import { documentMeta } from './documentMeta';
import { FileTypeIcon } from './FileTypeIcon';
import { StatusBadge } from './StatusBadge';

/**
 * One file in the register: kind icon and name on the first line; pages or sheets, the document
 * type and any problem on the second. The full path shows on hover.
 */
export function DocumentRow({ document }: { document: DocumentSummary }) {
  const type = document.classification?.type ?? null;
  return (
    <Group component="li" gap="xs" wrap="nowrap" align="flex-start" py={6} className={classes.arrive}>
      <FileTypeIcon kind={document.kind} />
      <Stack gap={2} flex={1} miw={0}>
        <Tooltip label={document.path}>
          <Text fz="sm" lh="xs" truncate="end" dir="auto">
            {document.name}
          </Text>
        </Tooltip>
        <Group gap="xs" justify="space-between" wrap="nowrap" mih={20}>
          <Text fz="xs" c="dimmed" truncate="end" className="tabular-nums">
            {documentMeta(document)}
          </Text>
          <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
            {type !== null && <Badge className={classes.arrive}>{type}</Badge>}
            <StatusBadge status={document.status} detail={document.statusDetail} />
          </Group>
        </Group>
      </Stack>
    </Group>
  );
}
