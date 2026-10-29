import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toApiError } from '../../api/ApiError';
import { silence } from '../../api/audioMeter';
import { api } from '../../api/endpoints';
import { type LiveConnection, openLiveCall } from '../../api/liveCall';
import { MicrophoneError } from '../../api/microphone';
import { queryKeys } from '../../api/queryKeys';
import { useVoices } from '../../api/useVoices';
import type { Language } from '../../i18n/language';
import { useLanguage } from '../../i18n/useLanguage';
import { useSession } from '../../state/useSession';
import { useChat } from '../chat/useChat';
import { errorMessage } from '../errors/errorCopy';
import { callCopy, endedMessage, microphoneMessage } from './callCopy';
import { type CallOutcome, CallSession, type CallView } from './CallSession';
import { VoiceCallContext, type VoiceCallValue, type VoiceNotice } from './VoiceCallContext';
import { chooseVoice, rememberedVoice, rememberVoice } from './voiceChoice';

interface OpenCall {
  session: CallSession;
  sessionId: string;
  connection: LiveConnection | null;
}

/** A notice not yet put into words, so it reads in the interface language even if that changes while it shows. */
interface PendingNotice {
  tone: VoiceNotice['tone'];
  text: (language: Language) => string;
}

const noCall = () => () => undefined;
const nothing = () => null;
/** A notice stays on the hint line this long, unless a new call replaces it. */
const NOTICE_MS = 20_000;

/**
 * Runs at most one voice call at a time. Each question the call hands over is asked through the chat as a spoken
 * turn. When a call ends its length goes to the server, which adds it to the chat's cost; a page closing mid-call
 * has the server hang it up. Clearing the chat ends the call.
 */
export function VoiceCallProvider({ children }: { children: ReactNode }) {
  const chat = useChat();
  const { sessionId } = useSession();
  const voices = useVoices();
  const queryClient = useQueryClient();
  const { language } = useLanguage();
  const [picked, setPicked] = useState<string | null>(rememberedVoice);
  const [open, setOpen] = useState<OpenCall | null>(null);
  const [notice, setNotice] = useState<PendingNotice | null>(null);
  const openRef = useRef<OpenCall | null>(null);
  const chatRef = useRef(chat);

  useEffect(() => {
    chatRef.current = chat;
  });

  useEffect(() => {
    if (notice === null) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const data = voices.data;
  const voiceId =
    data === undefined
      ? null
      : chooseVoice({ voices: data.voices, serverDefault: data.defaultVoice, remembered: picked, languages: navigator.languages ?? [] });

  const store = useMemo(
    () =>
      open === null
        ? { subscribe: noCall, snapshot: nothing }
        : { subscribe: (listener: () => void) => open.session.subscribe(listener), snapshot: () => open.session.snapshot() },
    [open],
  );
  const call = useSyncExternalStore(store.subscribe, store.snapshot);

  const report = useCallback(
    async (outcome: CallOutcome, callSessionId: string) => {
      if (outcome.callId === null) return;
      try {
        await api.endCall(outcome.callId, {
          sessionId: callSessionId,
          seconds: outcome.seconds,
          hangUp: !outcome.confirmed,
          diagnosis: outcome.diagnosis,
        });
      } catch (error) {
        console.warn('Could not report the end of the call', error);
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.usage(callSessionId) });
    },
    [queryClient],
  );

  const begin = useCallback(
    async (withVoice: string) => {
      if (openRef.current !== null || data === undefined) return;
      const session = new CallSession(
        {
          ask: (question) => chatRef.current.ask(question, { spoken: true }),
          stop: () => chatRef.current.stop(),
          noteSaid: (turnId, text) => chatRef.current.noteSaid(turnId, text),
        },
        { idleMs: data.idleSeconds * 1000, maxMs: data.maxCallMinutes * 60_000 },
      );
      const current: OpenCall = { session, sessionId, connection: null };
      openRef.current = current;
      setOpen(current);
      setNotice(null);
      void session.ended.then((outcome) => {
        if (openRef.current === current) {
          openRef.current = null;
          setOpen(null);
        }
        void report(outcome, current.sessionId);
        const { endReason } = session.snapshot();
        const { idleSeconds, maxCallMinutes } = data;
        const ended = (wording: Language) => endedMessage(endReason, idleSeconds, maxCallMinutes, wording);
        if (ended('en') !== null) setNotice({ tone: 'info', text: (wording) => ended(wording) ?? '' });
      });
      let connection: LiveConnection;
      try {
        connection = await openLiveCall({
          sessionId,
          voiceId: withVoice,
          onEvent: (event) => session.handle(event),
          onDropped: () => session.dropped(),
        });
      } catch (error) {
        void session.end('failed');
        setNotice({
          tone: 'error',
          text: (wording) =>
            error instanceof MicrophoneError
              ? microphoneMessage(error.problem, wording)
              : callCopy[wording].couldNotStart(errorMessage(toApiError(error), wording)),
        });
        return;
      }
      if (session.snapshot().status === 'ended') {
        // Hung up while it was still connecting: the call exists on the service and bills until it is hung up.
        connection.dispose();
        void api.endCall(connection.callId, { sessionId, seconds: 0, hangUp: true, diagnosis: connection.diagnosis() }).catch(() => undefined);
        return;
      }
      current.connection = connection;
      session.attach(connection);
      // A voice made for this call is ready from now on.
      void queryClient.invalidateQueries({ queryKey: queryKeys.voices });
    },
    [data, queryClient, report, sessionId],
  );

  const start = useCallback(() => {
    if (voiceId !== null) void begin(voiceId);
  }, [begin, voiceId]);

  const hangUp = useCallback(() => {
    void openRef.current?.session.end('hung_up');
  }, []);

  const chooseVoiceAndRestart = useCallback(
    (next: string) => {
      rememberVoice(next);
      setPicked(next);
      const current = openRef.current;
      if (current === null || current.session.snapshot().status !== 'live') return;
      // A call's voice is fixed when it starts, so a new voice means a new call; the chat carries the context over.
      void current.session.end('switching').then(() => begin(next));
    },
    [begin],
  );

  // A new chat (Clear chat) ends the call, which belongs to the old one.
  useEffect(() => {
    const current = openRef.current;
    if (current !== null && current.sessionId !== sessionId) void current.session.end('hung_up');
  }, [sessionId]);

  // Closing or reloading the page mid-call: tell the service to close, and have the server hang up in case it cannot.
  useEffect(() => {
    const onPageHide = () => {
      const current = openRef.current;
      if (current === null || current.connection === null) return;
      const seconds = current.session.snapshot().seconds;
      current.connection.send({ type: 'session.close', event_id: 'page_closed' });
      api.endCallOnExit(current.connection.callId, {
        sessionId: current.sessionId,
        seconds,
        hangUp: true,
        diagnosis: current.connection.diagnosis(),
      });
      current.connection.dispose();
    };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      void openRef.current?.session.end('hung_up');
    };
  }, []);

  const value = useMemo<VoiceCallValue>(
    () => ({
      callsAvailable: data?.callsAvailable ?? false,
      dictationAvailable: data?.dictationAvailable ?? false,
      maxDictationSeconds: data?.maxDictationSeconds ?? 120,
      voices: data?.voices ?? [],
      preparingVoices: data?.preparingVoices ?? false,
      voiceId,
      chooseVoice: chooseVoiceAndRestart,
      call: call satisfies CallView | null,
      notice: notice === null ? null : { tone: notice.tone, text: notice.text(language) },
      pricePerMinute: data?.callPricePerMinute ?? 0,
      levels: () => openRef.current?.session.levels() ?? silence,
      start,
      hangUp,
      setMuted: (muted) => openRef.current?.session.setMuted(muted),
      stopQuestion: () => openRef.current?.session.stopQuestion(),
    }),
    [data, voiceId, chooseVoiceAndRestart, call, notice, language, start, hangUp],
  );

  return <VoiceCallContext.Provider value={value}>{children}</VoiceCallContext.Provider>;
}
