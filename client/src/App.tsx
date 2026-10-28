import { AppShell } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useIndexEvents } from './api/useIndexEvents';
import { ChatThread } from './features/chat/ChatThread';
import { Sidebar } from './features/sidebar/Sidebar';
import { TopBarActions } from './features/topbar/TopBarActions';
import { TopBar } from './shell/TopBar';
import { shellLayout } from './shell/layout';

/** The app frame: top bar, document sidebar, and the centred conversation column. */
export function App() {
  const [navOpened, { toggle: toggleNav }] = useDisclosure(false);
  const indexEvents = useIndexEvents();

  return (
    <AppShell
      header={{ height: shellLayout.headerHeight }}
      navbar={{ width: shellLayout.navbarWidth, breakpoint: 'sm', collapsed: { mobile: !navOpened } }}
    >
      <AppShell.Header>
        <TopBar navOpened={navOpened} onToggleNav={toggleNav} actions={<TopBarActions />} />
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Sidebar activity={indexEvents.activity} />
      </AppShell.Navbar>

      <AppShell.Main>
        <ChatThread />
      </AppShell.Main>
    </AppShell>
  );
}
