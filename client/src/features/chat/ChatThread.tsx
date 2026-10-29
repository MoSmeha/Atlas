import { Fragment, useRef } from 'react';
import { Divider, Stack } from '@mantine/core';
import { useFolderStatus } from '../../api/useFolderStatus';
import { useHealth } from '../../api/useHealth';
import { MainColumn } from '../../shell/MainColumn';
import { UsageReadout } from '../topbar/UsageReadout';
import { SourceViewerModal } from '../viewer/SourceViewerModal';
import { CallCard } from '../voice/CallCard';
import { useVoiceCall } from '../voice/useVoiceCall';
import { Composer } from './Composer';
import { EmptyState } from './EmptyState';
import { Turn } from './Turn';
import { askReadiness } from './askReadiness';
import { useChat } from './useChat';
import { useFollowScroll } from './useFollowScroll';
import { useOpenedSource } from './useOpenedSource';

/**
 * The conversation column: the empty state, then one turn per question, with the composer
 * docked at the bottom, or the call card while a voice call is open. The page scrolls to each new
 * turn and follows its answer as it streams. Clicking an answer's source opens it in the source
 * viewer, at its page or rows.
 */
export function ChatThread() {
  const { turns, streaming, ask, retry, stop } = useChat();
  const voice = useVoiceCall();
  const folder = useFolderStatus();
  const health = useHealth();
  const thread = useRef<HTMLDivElement>(null);
  useFollowScroll(thread, turns.at(-1)?.id ?? null, streaming);
  const { opened, open: openSource, close: closeSource } = useOpenedSource(turns);

  const readiness = askReadiness({
    status: folder.data,
    statusError: folder.error,
    apiKeyPresent: health.data?.apiKeyPresent,
  });

  return (
    <MainColumn
      composer={
        voice.call !== null ? (
          <CallCard />
        ) : (
          <Composer
            readiness={readiness}
            streaming={streaming}
            onSend={ask}
            onStop={stop}
            hintAside={<UsageReadout placement="composer" />}
            onStartCall={voice.callsAvailable ? voice.start : undefined}
            maxDictationSeconds={voice.dictationAvailable ? voice.maxDictationSeconds : undefined}
            notice={voice.notice}
          />
        )
      }
    >
      {turns.length === 0 ? (
        <EmptyState
          status={folder.data}
          statusError={folder.error}
          canAsk={readiness.canAsk}
          onAsk={ask}
          onReload={() => void folder.refetch()}
        />
      ) : (
        <Stack ref={thread} gap="xl" pb="md">
          {turns.map((turn, index) => (
            <Fragment key={turn.id}>
              {index > 0 && <Divider color="gray.2" />}
              <Turn
                turn={turn}
                onRetry={retry}
                openedSource={opened?.turnId === turn.id ? opened.source : null}
                onOpenSource={(source) => openSource(turn.id, source)}
              />
            </Fragment>
          ))}
        </Stack>
      )}
      <SourceViewerModal source={opened?.source ?? null} onClose={closeSource} />
    </MainColumn>
  );
}
