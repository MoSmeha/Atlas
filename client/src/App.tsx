import { AppShell } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { useIndexEvents } from './api/useIndexEvents';
import { ChatThread } from './features/chat/ChatThread';
import { Sidebar } from './features/sidebar/Sidebar';
import { TopBarActions } from './features/topbar/TopBarActions';
import { useLanguage } from './i18n/useLanguage';
import { shellLayout } from './shell/layout';
import { Opening } from './shell/Opening';
import resizeHandle from './shell/resizeHandle.module.css';
import { Sheet } from './shell/Sheet';
import { TopBar } from './shell/TopBar';
import { useSidebar } from './shell/useSidebar';

/**
 * The app frame: top bar and document sidebar as one chrome field, and the conversation on its inset
 * sheet. The sidebar closes from the top bar and its edge drags to resize it. The opening screen plays
 * over the frame while it loads. Notifications rise from the bottom corner at the end of the reading direction.
 */
export function App() {
  const sidebar = useSidebar();
  const indexEvents = useIndexEvents();
  const { dir } = useLanguage();

  return (
    <>
      <Opening />
      <Notifications position={dir === 'rtl' ? 'bottom-left' : 'bottom-right'} limit={3} />
      <AppShell
        header={{ height: shellLayout.headerHeight }}
        navbar={{
          width: shellLayout.navbarWidth,
          breakpoint: 'sm',
          collapsed: { mobile: !sidebar.mobileOpened, desktop: !sidebar.desktopOpened },
        }}
        resize={sidebar.resize}
        classNames={{ resizeHandle: resizeHandle.handle }}
      >
        <AppShell.Header>
          <TopBar
            navOpened={sidebar.mobileOpened}
            onToggleNav={sidebar.toggleMobile}
            sidebarOpened={sidebar.desktopOpened}
            onToggleSidebar={sidebar.toggleDesktop}
            actions={<TopBarActions />}
          />
        </AppShell.Header>

        <AppShell.Navbar p="md" pt="xs" inert={sidebar.hidden || undefined}>
          <Sidebar activity={indexEvents.activity} />
        </AppShell.Navbar>

        <AppShell.Main>
          <Sheet sidebarClosed={!sidebar.desktopOpened}>
            <ChatThread />
          </Sheet>
        </AppShell.Main>
      </AppShell>
    </>
  );
}
