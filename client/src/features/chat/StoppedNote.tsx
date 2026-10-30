import { Button, Group, Text } from '@mantine/core';
import { IconPlayerStopFilled } from '@tabler/icons-react';
import { useCopy } from '../../i18n/useCopy';
import { chatCopy } from './chatCopy';

interface StoppedNoteProps {
  /** Some answer text arrived before the stop. */
  hadText: boolean;
  onAskAgain: () => void;
}

/** A quiet line under an answer the user stopped. The text above it was never checked, and it says so. */
export function StoppedNote({ hadText, onAskAgain }: StoppedNoteProps) {
  const copy = useCopy(chatCopy).answer;
  return (
    <Group gap="xs" wrap="wrap">
      <IconPlayerStopFilled size={14} color="var(--mantine-color-gray-6)" aria-hidden />
      <Text fz="sm" c="dimmed">
        {hadText ? copy.stoppedWithText : copy.stoppedWithoutText}
      </Text>
      <Button variant="subtle" size="compact-sm" onClick={onAskAgain}>
        {copy.askAgain}
      </Button>
    </Group>
  );
}
