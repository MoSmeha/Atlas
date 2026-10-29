import { type FormEvent, type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { ActionIcon, Group, Loader, Stack, Text, Textarea, Tooltip } from '@mantine/core';
import { IconArrowUp, IconCheck, IconMicrophone, IconPhone, IconPlayerStopFilled, IconX } from '@tabler/icons-react';
import { toApiError } from '../../api/ApiError';
import { MicrophoneError } from '../../api/microphone';
import { useDictation } from '../../api/useDictation';
import type { Language } from '../../i18n/language';
import { useCopy } from '../../i18n/useCopy';
import { useLanguage } from '../../i18n/useLanguage';
import { useSession } from '../../state/useSession';
import { errorMessage } from '../errors/errorCopy';
import { clockText } from '../voice/callCopy';
import { LevelBars } from '../voice/LevelBars';
import type { VoiceNotice } from '../voice/VoiceCallContext';
import type { AskReadiness } from './askReadiness';
import { type ChatCopy, chatCopy } from './chatCopy';
import classes from './Composer.module.css';

type ComposerCopy = ChatCopy['composer'];

interface ComposerProps {
  readiness: AskReadiness;
  /** An answer is streaming, so the button stops it instead of sending. */
  streaming: boolean;
  onSend: (question: string) => void;
  onStop: () => void;
  /** Quiet text at the end of the hint line, such as the last answer's cost and time on a phone. */
  hintAside?: ReactNode;
  /** Starts a voice call; left out while calls are off. With an empty box it takes the Send button's place. */
  onStartCall?: () => void;
  /** Dictation into the box, up to this many seconds at a time; left out while it is off. */
  maxDictationSeconds?: number;
  /** Shown on the hint line in place of the hint, such as why the last call could not start. */
  notice?: VoiceNotice | null;
}

/** "The browser blocked the microphone…" for a microphone problem; the error in plain words for anything else. */
function dictationNotice(error: unknown, copy: ComposerCopy, language: Language): VoiceNotice {
  if (error instanceof MicrophoneError) return { tone: 'error', text: copy.microphone[error.problem] };
  return { tone: 'error', text: copy.dictationFailed(errorMessage(toApiError(error), language)) };
}

/** Why a question cannot be sent yet, in the interface language. */
function readinessText(hint: NonNullable<AskReadiness['hint']>, copy: ComposerCopy, language: Language): string {
  return typeof hint === 'string' ? copy.readiness[hint] : errorMessage(hint, language);
}

/** The longest question the server accepts. */
const MAX_QUESTION = 4000;

/**
 * The question box docked under the conversation. Enter sends, Shift+Enter starts a new line,
 * and while an answer streams the Send button becomes Stop (Esc works too). With the box empty the
 * button starts a voice call instead, and the microphone beside it dictates a question into the box.
 */
export function Composer({
  readiness,
  streaming,
  onSend,
  onStop,
  hintAside,
  onStartCall,
  maxDictationSeconds,
  notice,
}: ComposerProps) {
  const { language } = useLanguage();
  const copy = useCopy(chatCopy).composer;
  const [value, setValue] = useState('');
  // The failure itself is kept, so its message follows the interface language.
  const [dictationError, setDictationError] = useState<{ error: unknown } | null>(null);
  const hintId = useId();
  const input = useRef<HTMLTextAreaElement>(null);
  const { sessionId } = useSession();
  const dictation = useDictation({
    sessionId,
    maxSeconds: maxDictationSeconds ?? 120,
    onText: (text) => {
      setValue((current) => (current.trim() === '' ? text : `${current.trimEnd()} ${text}`).slice(0, MAX_QUESTION));
      requestAnimationFrame(() => input.current?.focus());
    },
    onError: (error) => setDictationError({ error }),
  });
  const shownNotice = dictationError ? dictationNotice(dictationError.error, copy, language) : (notice ?? null);
  const recording = dictation.phase === 'recording' || dictation.phase === 'starting';
  const transcribing = dictation.phase === 'transcribing';
  const question = value.trim();
  const canSend = readiness.canAsk && !streaming && question !== '' && !recording && !transcribing;
  const offerCall = onStartCall !== undefined && question === '' && !recording && !transcribing;

  const send = () => {
    if (!canSend) return;
    onSend(question);
    setValue('');
  };
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    send();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape' && streaming) {
      event.preventDefault();
      onStop();
      return;
    }
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    send();
  };

  // Esc throws a dictation away, wherever the focus is. It listens while the event is captured, because an open
  // tooltip, such as Cancel's under the pointer, takes Esc for itself once it bubbles.
  const cancelDictation = dictation.cancel;
  useEffect(() => {
    if (!recording) return;
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') cancelDictation();
    };
    window.addEventListener('keydown', onEscape, true);
    return () => window.removeEventListener('keydown', onEscape, true);
  }, [recording, cancelDictation]);

  const hint = recording
    ? copy.hint.recording
    : transcribing
      ? copy.hint.transcribing
      : readiness.hint !== null
        ? readinessText(readiness.hint, copy, language)
        : streaming
          ? copy.hint.streaming
          : onStartCall === undefined
            ? copy.hint.idle
            : copy.hint.idleWithCall;

  return (
    <Stack gap={6}>
      <form onSubmit={onSubmit}>
        <Group
          className={classes.box}
          data-disabled={readiness.canType ? undefined : true}
          gap="xs"
          wrap="nowrap"
          align="flex-end"
        >
          {recording ? (
            <Group className={classes.recording} gap="sm" wrap="nowrap" flex={1} aria-live="polite">
              <LevelBars level={dictation.level} />
              <Text fz="md" c="dimmed">
                {dictation.phase === 'starting' ? copy.openingMicrophone : copy.listening}
              </Text>
              {dictation.startedAt !== null && <RecordingClock startedAt={dictation.startedAt} />}
            </Group>
          ) : (
            <Textarea
              ref={input}
              classNames={{ root: classes.input }}
              flex={1}
              variant="unstyled"
              autosize
              minRows={1}
              maxRows={8}
              maxLength={MAX_QUESTION}
              value={value}
              onChange={(event) => {
                setValue(event.currentTarget.value);
                setDictationError(null);
              }}
              onKeyDown={onKeyDown}
              disabled={!readiness.canType || transcribing}
              placeholder={
                transcribing
                  ? copy.placeholder.transcribing
                  : readiness.canType
                    ? copy.placeholder.ready
                    : copy.placeholder.noFolder
              }
              aria-label={copy.question}
              aria-describedby={hintId}
              dir="auto"
            />
          )}
          {maxDictationSeconds !== undefined && (
            <DictationControls
              copy={copy}
              phase={dictation.phase}
              disabled={!readiness.canType}
              onStart={() => {
                setDictationError(null);
                void dictation.start();
              }}
              onFinish={dictation.finish}
              onCancel={dictation.cancel}
            />
          )}
          {streaming ? (
            <Tooltip label={copy.stopTip} openDelay={600}>
              <ActionIcon variant="filled" color="ink" size={34} radius="md" onClick={onStop} aria-label={copy.stop}>
                <IconPlayerStopFilled size={14} />
              </ActionIcon>
            </Tooltip>
          ) : offerCall ? (
            <Tooltip label={copy.callTip}>
              <ActionIcon
                variant="filled"
                color="ink"
                size={34}
                radius="md"
                onClick={onStartCall}
                disabled={!readiness.canAsk}
                aria-label={copy.call}
              >
                <IconPhone size={17} stroke={2} />
              </ActionIcon>
            </Tooltip>
          ) : (
            !recording && (
              <ActionIcon type="submit" variant="filled" color="ink" size={34} radius="md" disabled={!canSend} aria-label={copy.send}>
                <IconArrowUp size={18} stroke={2.25} />
              </ActionIcon>
            )
          )}
        </Group>
      </form>
      <Group gap="xs" wrap="nowrap" align="flex-start" justify="space-between" px="xs">
        {/* A voice problem reads as a field error, next to the controls that retry it. */}
        <Text
          id={hintId}
          fz="xs"
          c={shownNotice?.tone === 'error' ? 'var(--mantine-color-error)' : 'dimmed'}
          miw={0}
          role={shownNotice?.tone === 'error' ? 'alert' : undefined}
          aria-live="polite"
        >
          {shownNotice !== null && !recording && !transcribing ? shownNotice.text : hint}
        </Text>
        {hintAside}
      </Group>
    </Stack>
  );
}

interface DictationControlsProps {
  copy: ComposerCopy;
  phase: ReturnType<typeof useDictation>['phase'];
  disabled: boolean;
  onStart: () => void;
  onFinish: () => void;
  onCancel: () => void;
}

/** The microphone that dictates into the box; while it records, Cancel and a check mark that finishes. */
function DictationControls({ copy, phase, disabled, onStart, onFinish, onCancel }: DictationControlsProps) {
  if (phase === 'recording' || phase === 'starting') {
    return (
      <>
        <Tooltip label={copy.cancelTip} openDelay={400}>
          <ActionIcon variant="subtle" color="gray" size={34} radius="md" onClick={onCancel} aria-label={copy.cancelDictation}>
            <IconX size={17} stroke={1.75} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={copy.finishTip} openDelay={400}>
          <ActionIcon
            variant="filled"
            color="ink"
            size={34}
            radius="md"
            onClick={onFinish}
            disabled={phase === 'starting'}
            aria-label={copy.finishDictation}
          >
            <IconCheck size={18} stroke={2.25} />
          </ActionIcon>
        </Tooltip>
      </>
    );
  }
  return (
    <Tooltip label={copy.dictate} openDelay={400}>
      <ActionIcon
        variant="subtle"
        color="gray"
        size={34}
        radius="md"
        onClick={onStart}
        disabled={disabled || phase === 'transcribing'}
        aria-label={copy.dictate}
      >
        {phase === 'transcribing' ? <Loader size={14} color="gray" /> : <IconMicrophone size={18} stroke={1.75} />}
      </ActionIcon>
    </Tooltip>
  );
}

/** "0:07": how long the dictation has been recording. */
function RecordingClock({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  return (
    <Text fz="sm" c="dimmed" className="tabular-nums">
      {clockText((now - startedAt) / 1000)}
    </Text>
  );
}
