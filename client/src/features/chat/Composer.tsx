import { type FormEvent, type KeyboardEvent, type ReactNode, useId, useState } from 'react';
import { ActionIcon, Group, Stack, Text, Textarea, Tooltip } from '@mantine/core';
import { IconArrowUp, IconPlayerStopFilled } from '@tabler/icons-react';
import type { AskReadiness } from './askReadiness';
import classes from './Composer.module.css';

interface ComposerProps {
  readiness: AskReadiness;
  /** An answer is streaming, so the button stops it instead of sending. */
  streaming: boolean;
  onSend: (question: string) => void;
  onStop: () => void;
  /** Quiet text at the end of the hint line, such as the last answer's cost and time on a phone. */
  hintAside?: ReactNode;
}

/** The longest question the server accepts. */
const MAX_QUESTION = 4000;

/**
 * The question box docked under the conversation. Enter sends, Shift+Enter starts a new line,
 * and while an answer streams the Send button becomes Stop (Esc works too).
 */
export function Composer({ readiness, streaming, onSend, onStop, hintAside }: ComposerProps) {
  const [value, setValue] = useState('');
  const hintId = useId();
  const question = value.trim();
  const canSend = readiness.canAsk && !streaming && question !== '';

  const send = () => {
    if (!canSend) return;
    onSend(question);
    setValue('');
  };
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    send();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape' && streaming) {
      event.preventDefault();
      onStop();
      return;
    }
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    send();
  };

  const hint =
    readiness.hint ?? (streaming ? 'Atlas is answering. Stop it with the button or Esc.' : 'Enter sends. Shift + Enter adds a line.');

  return (
    <Stack gap={6}>
      <form onSubmit={onSubmit}>
        <Group
          className={classes.box}
          data-disabled={readiness.canType ? undefined : true}
          gap="xs"
          wrap="nowrap"
          align="flex-end"
        >
          <Textarea
            classNames={{ root: classes.input }}
            flex={1}
            variant="unstyled"
            autosize
            minRows={1}
            maxRows={8}
            maxLength={MAX_QUESTION}
            value={value}
            onChange={(event) => setValue(event.currentTarget.value)}
            onKeyDown={onKeyDown}
            disabled={!readiness.canType}
            placeholder={readiness.canType ? 'Ask a question about these documents' : 'Load a folder to ask a question'}
            aria-label="Question"
            aria-describedby={hintId}
            dir="auto"
          />
          {streaming ? (
            <Tooltip label="Stop the answer (Esc)" openDelay={600}>
              <ActionIcon variant="filled" color="ink" size={34} radius="md" onClick={onStop} aria-label="Stop the answer">
                <IconPlayerStopFilled size={14} />
              </ActionIcon>
            </Tooltip>
          ) : (
            <ActionIcon type="submit" variant="filled" color="ink" size={34} radius="md" disabled={!canSend} aria-label="Send the question">
              <IconArrowUp size={18} stroke={2.25} />
            </ActionIcon>
          )}
        </Group>
      </form>
      <Group gap="xs" wrap="nowrap" align="flex-start" justify="space-between" px="xs">
        <Text id={hintId} fz="xs" c="dimmed" miw={0} aria-live="polite">
          {hint}
        </Text>
        {hintAside}
      </Group>
    </Stack>
  );
}
