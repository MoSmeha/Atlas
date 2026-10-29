import { useState } from 'react';
import { ActionIcon, Button, Group, Popover, Stack, Text, Tooltip } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { useCopy } from '../../i18n/useCopy';
import classes from './FolderTree.module.css';
import { sidebarCopy } from './sidebarCopy';

/** The question asked before a removal that cannot be undone. */
export interface RemoveQuestion {
  title: string;
  body: string;
  /** The confirming button, such as "Delete". */
  action: string;
}

interface RemoveButtonProps {
  /** Names the file or folder for a screen reader, such as "Remove BOQ.pdf from Atlas". */
  label: string;
  /** Asked first when the removal cannot be undone; null removes at once. */
  question: RemoveQuestion | null;
  onRemove: () => void;
  pending: boolean;
}

/**
 * The small × at the end of a file or folder row, shown under the pointer and on keyboard focus. A removal that
 * deletes something asks first, in a popover beside the button.
 */
export function RemoveButton({ label, question, onRemove, pending }: RemoveButtonProps) {
  const copy = useCopy(sidebarCopy);
  const [asking, setAsking] = useState(false);

  const button = (
    <Tooltip label={copy.removeTip} openDelay={400} disabled={asking}>
      <ActionIcon
        variant="subtle"
        color="gray"
        size={22}
        radius="sm"
        loading={pending}
        aria-label={label}
        aria-haspopup={question === null ? undefined : 'dialog'}
        aria-expanded={question === null ? undefined : asking}
        onClick={() => (question === null ? onRemove() : setAsking((open) => !open))}
      >
        <IconX size={14} stroke={1.75} />
      </ActionIcon>
    </Tooltip>
  );

  if (question === null) {
    return <span className={classes.removeSlot}>{button}</span>;
  }

  return (
    <span className={classes.removeSlot} data-open={asking || undefined}>
      <Popover opened={asking} onChange={setAsking} position="bottom-end" width={260} withinPortal trapFocus returnFocus>
        <Popover.Target>{button}</Popover.Target>
        <Popover.Dropdown p="sm" role="dialog" aria-label={question.title}>
          <Stack gap="xs">
            <Text fz="sm" fw={600} dir="auto" style={{ overflowWrap: 'anywhere' }}>
              {question.title}
            </Text>
            <Text fz="xs" c="dimmed">
              {question.body}
            </Text>
            <Group gap="xs" justify="flex-end">
              <Button variant="default" size="xs" onClick={() => setAsking(false)}>
                {copy.cancel}
              </Button>
              <Button
                color="red"
                size="xs"
                onClick={() => {
                  setAsking(false);
                  onRemove();
                }}
              >
                {question.action}
              </Button>
            </Group>
          </Stack>
        </Popover.Dropdown>
      </Popover>
    </span>
  );
}
