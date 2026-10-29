import type { ReactNode } from 'react';
import { Burger, Group } from '@mantine/core';
import { useCopy } from '../i18n/useCopy';
import { shellCopy } from './shellCopy';
import { Wordmark } from './Wordmark';

interface TopBarProps {
  /** End-side controls: the model picker, Clear chat, language and theme. */
  actions: ReactNode;
  navOpened: boolean;
  onToggleNav: () => void;
}

/** The 52px top bar: mark and wordmark at the start, session controls at the end. */
export function TopBar({ actions, navOpened, onToggleNav }: TopBarProps) {
  const copy = useCopy(shellCopy);
  return (
    <Group h="100%" px="md" justify="space-between" wrap="nowrap" gap="md">
      <Group gap="sm" wrap="nowrap">
        <Burger
          opened={navOpened}
          onClick={onToggleNav}
          hiddenFrom="sm"
          size="sm"
          aria-label={navOpened ? copy.hideDocuments : copy.showDocuments}
        />
        <Wordmark />
      </Group>
      <Group gap="xs" wrap="nowrap" miw={0}>
        {actions}
      </Group>
    </Group>
  );
}
