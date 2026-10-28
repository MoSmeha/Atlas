import { AppShell } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { MainColumn } from './shell/MainColumn';
import { SlotPlaceholder } from './shell/SlotPlaceholder';
import { TopBar } from './shell/TopBar';
import { shellLayout } from './shell/layout';

/** The app frame: top bar, document sidebar, and the centred conversation column. */
export function App() {
  const [navOpened, { toggle: toggleNav }] = useDisclosure(false);

  return (
    <AppShell
      header={{ height: shellLayout.headerHeight }}
      navbar={{ width: shellLayout.navbarWidth, breakpoint: 'sm', collapsed: { mobile: !navOpened } }}
    >
      <AppShell.Header>
        <TopBar
          navOpened={navOpened}
          onToggleNav={toggleNav}
          actions={<SlotPlaceholder label="Model picker and Clear chat" owner="feature/client-picker" />}
        />
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <SlotPlaceholder
          label="Folder path, dropzone and document register"
          owner="feature/client-sidebar"
          grow
        />
      </AppShell.Navbar>

      <AppShell.Main>
        <MainColumn composer={<SlotPlaceholder label="Question box" owner="feature/client-chat" />}>
          <SlotPlaceholder label="Suggested questions, then answers" owner="feature/client-chat" grow />
        </MainColumn>
      </AppShell.Main>
    </AppShell>
  );
}
