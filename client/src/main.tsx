import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dropzone/styles.css';
import './styles/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { ChatProvider } from './features/chat/ChatProvider';
import { DocumentViewerProvider } from './features/viewer/DocumentViewerProvider';
import { VoiceCallProvider } from './features/voice/VoiceCallProvider';
import { queryClient } from './queryClient';
import { SessionProvider } from './state/SessionProvider';
import { cssVariablesResolver, theme } from './theme';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('The page has no #root element to render Atlas into.');

createRoot(rootElement).render(
  <StrictMode>
    <MantineProvider
      theme={theme}
      cssVariablesResolver={cssVariablesResolver}
      defaultColorScheme="light"
      forceColorScheme="light"
    >
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
    </MantineProvider>
  </StrictMode>,
);
