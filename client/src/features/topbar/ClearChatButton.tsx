import { ActionIcon, Button, Tooltip } from '@mantine/core';
import { IconEraser } from '@tabler/icons-react';
import { useChat } from '../chat/useChat';
import { notifyError } from '../errors/notifyError';

/**
 * Stops any running answer, forgets the chat on the server, empties the thread and starts a new
 * session. Disabled while there is nothing to clear. On narrow screens it shrinks to an icon.
 */
export function ClearChatButton() {
  const { turns, clear, clearing } = useChat();
  const disabled = turns.length === 0;
  const onClear = () => {
    clear().catch((error: unknown) => notifyError(error, 'Atlas could not clear the chat'));
  };
  const icon = <IconEraser size={16} stroke={1.75} aria-hidden />;

  return (
    <>
      <Button
        visibleFrom="sm"
        variant="default"
        leftSection={icon}
        loading={clearing}
        disabled={disabled}
        onClick={onClear}
      >
        Clear chat
      </Button>
      <Tooltip label="Clear chat">
        <ActionIcon
          hiddenFrom="sm"
          variant="default"
          aria-label="Clear chat"
          loading={clearing}
          disabled={disabled}
          onClick={onClear}
        >
          {icon}
        </ActionIcon>
      </Tooltip>
    </>
  );
}
