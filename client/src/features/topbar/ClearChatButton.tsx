import { ActionIcon, Button, Tooltip } from '@mantine/core';
import { IconEraser } from '@tabler/icons-react';
import { useCopy } from '../../i18n/useCopy';
import { useLanguage } from '../../i18n/useLanguage';
import { useChat } from '../chat/useChat';
import { notifyError } from '../errors/notifyError';
import { topbarCopy } from './topbarCopy';

/**
 * Stops any running answer, forgets the chat on the server, empties the thread and starts a new
 * session. Disabled while there is nothing to clear. On narrow screens it shrinks to an icon.
 */
export function ClearChatButton() {
  const { turns, clear, clearing } = useChat();
  const { language } = useLanguage();
  const copy = useCopy(topbarCopy);
  const disabled = turns.length === 0;
  const onClear = () => {
    clear().catch((error: unknown) => notifyError(error, copy.clearFailed, language));
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
        {copy.clearChat}
      </Button>
      <Tooltip label={copy.clearChat}>
        <ActionIcon
          hiddenFrom="sm"
          variant="default"
          aria-label={copy.clearChat}
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
