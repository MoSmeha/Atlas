import { AppShell } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Notifications } from '@mantine/notifications';
import { useIndexEvents } from './api/useIndexEvents';
import { ChatThread } from './features/chat/ChatThread';
import { Sidebar } from './features/sidebar/Sidebar';
import { TopBarActions } from './features/topbar/TopBarActions';
import { useLanguage } from './i18n/useLanguage';
import { shellLayout } from './shell/layout';
import { Sheet } from './shell/Sheet';
import { TopBar } from './shell/TopBar';

/**
 * The app frame: top bar and document sidebar as one chrome field, and the conversation on its inset
 * sheet. Notifications rise from the bottom corner at the end of the reading direction.
 */
export function App() {
  const [navOpened, { toggle: toggleNav }] = useDisclosure(false);
  const indexEvents = useIndexEvents();
  const { dir } = useLanguage();

  return (
    <>
      <Notifications position={dir === 'rtl' ? 'bottom-left' : 'bottom-right'} limit={3} />
      <AppShell
        header={{ height: shellLayout.headerHeight }}
        navbar={{ width: shellLayout.navbarWidth, breakpoint: 'sm', collapsed: { mobile: !navOpened } }}
      >
        <AppShell.Header>
          <TopBar navOpened={navOpened} onToggleNav={toggleNav} actions={<TopBarActions />} />
        </AppShell.Header>

        <AppShell.Navbar p="md" pt="xs">
          <Sidebar activity={indexEvents.activity} />
        </AppShell.Navbar>

        <AppShell.Main>
          <Sheet>
            <ChatThread />
          </Sheet>
        </AppShell.Main>
      </AppShell>
    </>
  );
}
