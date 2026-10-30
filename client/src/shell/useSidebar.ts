import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type AppShellResizeController, useAppShellResize } from '@mantine/core';
import { useDisclosure, useHotkeys, useMediaQuery } from '@mantine/hooks';
import { useCopy } from '../i18n/useCopy';
import { shellCopy } from './shellCopy';
import { readSidebarPrefs, saveSidebarPrefs, sidebarBounds } from './sidebarPrefs';

export interface SidebarControls {
  /** Open over the conversation on a phone. */
  mobileOpened: boolean;
  toggleMobile: () => void;
  /** Open beside the conversation on a wide screen; remembered. */
  desktopOpened: boolean;
  toggleDesktop: () => void;
  /** Mantine's resize controller for AppShell: the dragged width, remembered. */
  resize: AppShellResizeController;
  /** Off screen at the current width, so its controls must not take focus. */
  hidden: boolean;
}

/**
 * The documents sidebar's state. On a wide screen it opens and closes from the top bar or with Ctrl+B
 * (Cmd+B on a Mac), and its edge drags between 240 and 480px; dragging it narrower than 160px closes it,
 * and it reopens at the width it had before. Double-clicking the edge returns it to 300px. Width and
 * open state are kept for the next visit. On a phone it folds behind the burger, as before.
 */
export function useSidebar(): SidebarControls {
  const copy = useCopy(shellCopy);
  const [saved] = useState(readSidebarPrefs);
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure(false);
  const [desktopOpened, setDesktopOpened] = useState(saved.open);
  const wide = useMediaQuery('(min-width: 48em)', true);
  // Set while a drag has closed the sidebar: the width to reopen it at (null for the default).
  const reopenAt = useRef<number | null | undefined>(undefined);

  const initialSizes = useMemo(() => (saved.width === null ? undefined : { navbar: saved.width }), [saved.width]);
  const navbar = useMemo(
    () => ({ min: sidebarBounds.min, max: sidebarBounds.max, collapseThreshold: sidebarBounds.closeBelow, label: copy.resizeDocuments }),
    [copy.resizeDocuments],
  );

  const resize = useAppShellResize({
    navbar,
    initialSizes,
    onCollapseChange: (_, collapsed) => {
      reopenAt.current = collapsed ? (resize.navbar.size ?? null) : undefined;
      setDesktopOpened(!collapsed);
    },
    onResizeEnd: () => {
      if (reopenAt.current === undefined) return;
      if (reopenAt.current === null) resize.navbar.reset();
      else resize.navbar.setSize(reopenAt.current);
      reopenAt.current = undefined;
    },
  });

  const width = resize.navbar.size;
  useEffect(() => {
    saveSidebarPrefs({ open: desktopOpened, width: width === undefined ? null : width });
  }, [desktopOpened, width]);

  const toggleDesktop = useCallback(() => setDesktopOpened((open) => !open), []);
  // The shortcut works from the question box too: a plain text box gives Ctrl+B no other meaning.
  useHotkeys([['mod+B', () => (wide ? toggleDesktop() : toggleMobile())]], []);

  return { mobileOpened, toggleMobile, desktopOpened, toggleDesktop, resize, hidden: wide ? !desktopOpened : !mobileOpened };
}
