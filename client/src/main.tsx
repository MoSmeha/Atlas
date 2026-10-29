import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dropzone/styles.css';
import './styles/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DirectionProvider, localStorageColorSchemeManager, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { ChatProvider } from './features/chat/ChatProvider';
import { DocumentViewerProvider } from './features/viewer/DocumentViewerProvider';
import { VoiceCallProvider } from './features/voice/VoiceCallProvider';
import { LanguageProvider } from './i18n/LanguageProvider';
import { queryClient } from './queryClient';
import { SessionProvider } from './state/SessionProvider';
import { COLOR_SCHEME_STORAGE_KEY, cssVariablesResolver, theme } from './theme';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('The page has no #root element to render Atlas into.');

// Light by default: Atlas is used in daytime offices and on shared meeting-room screens. The choice is kept.
const colorSchemeManager = localStorageColorSchemeManager({ key: COLOR_SCHEME_STORAGE_KEY });

createRoot(rootElement).render(
  <StrictMode>
    <DirectionProvider>
      <MantineProvider
        theme={theme}
        cssVariablesResolver={cssVariablesResolver}
        colorSchemeManager={colorSchemeManager}
        defaultColorScheme="light"
      >
        <LanguageProvider>
          <Notifications position="bottom-right" limit={3} />
          <QueryClientProvider client={queryClient}>
            <SessionProvider>
              <ChatProvider>
                <VoiceCallProvider>
                  <DocumentViewerProvider>
                    <App />
                  </DocumentViewerProvider>
                </VoiceCallProvider>
              </ChatProvider>
            </SessionProvider>
          </QueryClientProvider>
        </LanguageProvider>
      </MantineProvider>
    </DirectionProvider>
  </StrictMode>,
);
