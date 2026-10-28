import type { ReactNode } from 'react';
import { Burger, Group } from '@mantine/core';
import { Wordmark } from './Wordmark';

interface TopBarProps {
  /** Right-hand controls: the model picker and Clear chat. */
  actions: ReactNode;
  navOpened: boolean;
  onToggleNav: () => void;
}

/** The 52px top bar: wordmark on the left, session controls on the right. */
export function TopBar({ actions, navOpened, onToggleNav }: TopBarProps) {
  return (
    <Group h="100%" px="md" justify="space-between" wrap="nowrap" gap="md">
      <Group gap="sm" wrap="nowrap">
        <Burger
          opened={navOpened}
          onClick={onToggleNav}
          hiddenFrom="sm"
          size="sm"
          aria-label={navOpened ? 'Hide documents' : 'Show documents'}
        />
        <Wordmark />
      </Group>
      <Group gap="sm" wrap="nowrap" miw={0}>
        {actions}
      </Group>
    </Group>
  );
}
