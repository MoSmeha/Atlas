import { Fragment, useCallback, useRef, useState } from 'react';
import { Divider, Stack } from '@mantine/core';
import { useFolderStatus } from '../../api/useFolderStatus';
import { useHealth } from '../../api/useHealth';
import { MainColumn } from '../../shell/MainColumn';
import { Opening } from '../../shell/Opening';
import { UsageReadout } from '../topbar/UsageReadout';
import { SourceViewerModal } from '../viewer/SourceViewerModal';
import { CallButton } from '../voice/CallButton';
import { CallCard } from '../voice/CallCard';
import { useVoiceCall } from '../voice/useVoiceCall';
import { Composer } from './Composer';
import { Turn } from './Turn';
import { askReadiness } from './askReadiness';
import { useChat } from './useChat';
import { useFollowScroll } from './useFollowScroll';
import { useOpenedSource } from './useOpenedSource';

/**
 * The conversation column: Atlas's face and line before the first question, then one turn per question, with the
 * composer docked at the bottom, or the call card while a voice call is open. The page scrolls to each new turn and
 * follows its answer as it streams. Clicking an answer's source opens it in the source viewer, at its page or rows.
 */
export function ChatThread() {
  const { turns, streaming, ask, retry, stop } = useChat();
  const voice = useVoiceCall();
  const folder = useFolderStatus();
  const health = useHealth();
  const thread = useRef<HTMLDivElement>(null);
  useFollowScroll(thread, turns.at(-1)?.id ?? null, streaming);
  const { opened, open: openSource, close: closeSource } = useOpenedSource(turns);
  const [composing, setComposing] = useState(false);
  // On a fresh page the composer waits below the sheet until Atlas has said its line; then it stays docked.
  const [composerShown, setComposerShown] = useState(turns.length > 0);
  const showComposer = useCallback(() => setComposerShown(true), []);

  const readiness = askReadiness({
    status: folder.data,
    statusError: folder.error,
    apiKeyPresent: health.data?.apiKeyPresent,
  });

  const composer =
    voice.call !== null ? (
      <CallCard />
    ) : (
      <Composer
        readiness={readiness}
        streaming={streaming}
        onSend={ask}
        onStop={stop}
        hintAside={<UsageReadout placement="composer" />}
        callButton={voice.callsAvailable ? <CallButton disabled={!readiness.canAsk} /> : undefined}
        maxDictationSeconds={voice.dictationAvailable ? voice.maxDictationSeconds : undefined}
        notice={voice.notice}
        onComposingChange={setComposing}
      />
    );

  return (
    <MainColumn composer={composer} composerWaiting={!composerShown}>
      {turns.length === 0 ? (
        <Opening away={composing || voice.call !== null} onSaid={showComposer} />
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
