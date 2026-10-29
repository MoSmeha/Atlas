import type { DocumentSummary } from '@atlas/shared';
import { Badge, Group, Stack, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { useDocumentViewer } from '../viewer/useDocumentViewer';
import arrive from './arrive.module.css';
import { documentMeta } from './documentMeta';
import { FileTypeIcon } from './FileTypeIcon';
import { StatusBadge } from './StatusBadge';
import classes from './DocumentRow.module.css';

/**
 * One file in the register: kind icon and name on the first line; pages or sheets, the document
 * type and any problem on the second. The full path shows on hover, and the whole row opens the
 * file in the viewer.
 */
export function DocumentRow({ document }: { document: DocumentSummary }) {
  const viewer = useDocumentViewer();
  const type = document.classification?.type ?? null;
  const active = viewer.openedId === document.id;

  return (
    <Group
      component="li"
      gap="xs"
      wrap="nowrap"
      align="flex-start"
      className={`${arrive.arrive} ${classes.row}`}
      data-active={active || undefined}
    >
      <FileTypeIcon kind={document.kind} />
      <Stack gap={2} flex={1} miw={0}>
        <Tooltip label={document.path}>
          <UnstyledButton
            className={classes.open}
            onClick={() => viewer.open(document.id)}
            aria-haspopup="dialog"
            aria-current={active || undefined}
          >
            <Text component="span" display="block" fz="sm" lh="xs" truncate="end">
              {document.name}
            </Text>
          </UnstyledButton>
        </Tooltip>
        <Group gap="xs" justify="space-between" wrap="nowrap" mih={20}>
          <Text fz="xs" c="dimmed" truncate="end" className="tabular-nums">
            {documentMeta(document)}
          </Text>
          <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
            {type !== null && <Badge className={arrive.arrive}>{type}</Badge>}
            <StatusBadge status={document.status} detail={document.statusDetail} className={classes.status} />
          </Group>
        </Group>
      </Stack>
    </Group>
  );
}
