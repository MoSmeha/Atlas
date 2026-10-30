import type { ReactNode } from 'react';
import { ActionIcon, Burger, Group, Tooltip } from '@mantine/core';
import {
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconLayoutSidebarRightCollapse,
  IconLayoutSidebarRightExpand,
} from '@tabler/icons-react';
import { useCopy } from '../i18n/useCopy';
import { useLanguage } from '../i18n/useLanguage';
import { shellCopy } from './shellCopy';
import { Wordmark } from './Wordmark';

interface TopBarProps {
  /** End-side controls: the model picker, Clear chat, language and theme. */
  actions: ReactNode;
  /** The sidebar over the conversation on a phone, behind the burger. */
  navOpened: boolean;
  onToggleNav: () => void;
  /** The sidebar beside the conversation on a wide screen. */
  sidebarOpened: boolean;
  onToggleSidebar: () => void;
}

/** Ctrl+B, or Cmd+B on a Mac, as the tooltip names it. */
const shortcut = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘B' : 'Ctrl+B';

/**
 * The 52px top bar: the sidebar toggle, mark and wordmark at the start, session controls at the end. The
 * toggle's panel sits on the side the sidebar is on, so it mirrors in Arabic.
 */
export function TopBar({ actions, navOpened, onToggleNav, sidebarOpened, onToggleSidebar }: TopBarProps) {
  const copy = useCopy(shellCopy);
  const { dir } = useLanguage();
  const label = sidebarOpened ? copy.hideDocuments : copy.showDocuments;
  const SidebarIcon =
    dir === 'rtl'
      ? sidebarOpened
        ? IconLayoutSidebarRightCollapse
        : IconLayoutSidebarRightExpand
      : sidebarOpened
        ? IconLayoutSidebarLeftCollapse
        : IconLayoutSidebarLeftExpand;

  return (
    <Group h="100%" px="md" justify="space-between" wrap="nowrap" gap="md">
      <Group gap="xs" wrap="nowrap">
        <Burger
          opened={navOpened}
          onClick={onToggleNav}
          hiddenFrom="sm"
          size="sm"
          aria-label={navOpened ? copy.hideDocuments : copy.showDocuments}
        />
        <Tooltip
          label={
            <>
              {label}
              <span dir="ltr" style={{ marginInlineStart: 'var(--mantine-spacing-xs)', opacity: 0.65 }}>
                {shortcut}
              </span>
            </>
          }
        >
          <ActionIcon
            visibleFrom="sm"
            onClick={onToggleSidebar}
            aria-label={label}
            aria-expanded={sidebarOpened}
            aria-keyshortcuts="Control+B Meta+B"
            // The glyph, not its 34px button, lines up with the sidebar's 16px gutter below it.
            ms="calc(var(--mantine-spacing-xs) * -1)"
          >
            <SidebarIcon size={18} stroke={1.75} />
          </ActionIcon>
        </Tooltip>
        <Wordmark />
      </Group>
      <Group gap="xs" wrap="nowrap" miw={0}>
        {actions}
      </Group>
    </Group>
  );
}
