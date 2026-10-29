import { type FormEvent, type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { ActionIcon, Group, Loader, Stack, Text, Textarea, Tooltip } from '@mantine/core';
import { IconArrowUp, IconCheck, IconMicrophone, IconPhone, IconPlayerStopFilled, IconX } from '@tabler/icons-react';
import { toApiError } from '../../api/ApiError';
import { MicrophoneError } from '../../api/microphone';
import { useDictation } from '../../api/useDictation';
import { useSession } from '../../state/useSession';
import { errorMessage } from '../errors/errorCopy';
import { clockText, microphoneMessage } from '../voice/callCopy';
import { LevelBars } from '../voice/LevelBars';
import type { VoiceNotice } from '../voice/VoiceCallContext';
import type { AskReadiness } from './askReadiness';
import classes from './Composer.module.css';

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
function dictationNotice(error: unknown): VoiceNotice {
  if (error instanceof MicrophoneError) return { tone: 'error', text: microphoneMessage(error.problem) };
  return { tone: 'error', text: `Atlas could not write down what you said. ${errorMessage(toApiError(error))}` };
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
  const [value, setValue] = useState('');
  const [ownNotice, setOwnNotice] = useState<VoiceNotice | null>(null);
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
    onError: (error) => setOwnNotice(dictationNotice(error)),
  });
  const shownNotice = ownNotice ?? notice ?? null;
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
    ? 'Say your question. The check mark writes it into the box; Esc cancels.'
    : transcribing
      ? 'Writing down what you said.'
      : (readiness.hint ??
        (streaming
          ? 'Atlas is answering. Stop it with the button or Esc.'
          : onStartCall === undefined
            ? 'Enter sends. Shift + Enter adds a line.'
            : 'Enter sends. Shift + Enter adds a line. The phone starts a voice call.'));

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
                {dictation.phase === 'starting' ? 'Opening the microphone…' : 'Listening'}
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
                setOwnNotice(null);
              }}
              onKeyDown={onKeyDown}
              disabled={!readiness.canType || transcribing}
              placeholder={
                transcribing
                  ? 'Writing down what you said…'
                  : readiness.canType
                    ? 'Ask a question about these documents'
                    : 'Load a folder to ask a question'
              }
              aria-label="Question"
              aria-describedby={hintId}
              dir="auto"
            />
          )}
          {maxDictationSeconds !== undefined && (
            <DictationControls
              phase={dictation.phase}
              disabled={!readiness.canType}
              onStart={() => {
                setOwnNotice(null);
                void dictation.start();
              }}
              onFinish={dictation.finish}
              onCancel={dictation.cancel}
            />
          )}
          {streaming ? (
            <Tooltip label="Stop the answer (Esc)" openDelay={600}>
              <ActionIcon variant="filled" color="ink" size={34} radius="md" onClick={onStop} aria-label="Stop the answer">
                <IconPlayerStopFilled size={14} />
              </ActionIcon>
            </Tooltip>
          ) : offerCall ? (
            <Tooltip label="Talk to Atlas in a voice call">
              <ActionIcon
                variant="filled"
                color="ink"
                size={34}
                radius="md"
                onClick={onStartCall}
                disabled={!readiness.canAsk}
                aria-label="Start a voice call"
              >
                <IconPhone size={17} stroke={2} />
              </ActionIcon>
            </Tooltip>
          ) : (
            !recording && (
              <ActionIcon type="submit" variant="filled" color="ink" size={34} radius="md" disabled={!canSend} aria-label="Send the question">
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
  phase: ReturnType<typeof useDictation>['phase'];
  disabled: boolean;
  onStart: () => void;
  onFinish: () => void;
  onCancel: () => void;
}

/** The microphone that dictates into the box; while it records, Cancel and a check mark that finishes. */
function DictationControls({ phase, disabled, onStart, onFinish, onCancel }: DictationControlsProps) {
  if (phase === 'recording' || phase === 'starting') {
    return (
      <>
        <Tooltip label="Cancel (Esc)" openDelay={400}>
          <ActionIcon variant="subtle" color="gray" size={34} radius="md" onClick={onCancel} aria-label="Cancel the dictation">
            <IconX size={17} stroke={1.75} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Write it into the box" openDelay={400}>
          <ActionIcon
            variant="filled"
            color="ink"
            size={34}
            radius="md"
            onClick={onFinish}
            disabled={phase === 'starting'}
            aria-label="Finish the dictation"
          >
            <IconCheck size={18} stroke={2.25} />
          </ActionIcon>
        </Tooltip>
      </>
    );
  }
  return (
    <Tooltip label="Dictate a question" openDelay={400}>
      <ActionIcon
        variant="subtle"
        color="gray"
        size={34}
        radius="md"
        onClick={onStart}
        disabled={disabled || phase === 'transcribing'}
        aria-label="Dictate a question"
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
