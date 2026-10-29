import { type ReactNode, useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type { ApiError } from '../../api/ApiError';
import type { AskHandlers } from '../../api/askQuestion';
import { type AskController, useAskStream } from '../../api/useAskStream';
import { useClearChat } from '../../api/useClearChat';
import { useSession } from '../../state/useSession';
import { type AskOptions, ChatContext, type ChatContextValue, type TurnEnd } from './ChatContext';
import { type TurnError, chatReducer, isStreaming, noTurns } from './chatReducer';

interface Running {
  turnId: string;
  controller: AskController | null;
  /** What to say aloud about the answer, when the question was spoken. */
  speech: string | null;
  /** Settles the promise ask returned. */
  settle: (end: TurnEnd) => void;
}

/** Holds the conversation for the current session and streams each question into it. */
export function ChatProvider({ children }: { children: ReactNode }) {
  const [turns, dispatch] = useReducer(chatReducer, noTurns);
  const { sessionId, model, startNewSession } = useSession();
  const running = useRef<Running | null>(null);
  const latest = useRef({ turns, model });
  const nextId = useRef(0);
  const clearChat = useClearChat();

  useEffect(() => {
    latest.current = { turns, model };
  });

  const onRunning = (deliver: (turnId: string) => void) => {
    const turnId = running.current?.turnId;
    if (turnId !== undefined) deliver(turnId);
  };
  /** Ends the running question: it is no longer running, and whoever asked it hears how it ended. */
  const settle = (end: (turnId: string, speech: string | null) => TurnEnd) => {
    const current = running.current;
    if (current === null) return;
    running.current = null;
    current.settle(end(current.turnId, current.speech));
  };
  const handlers: AskHandlers = {
    onStarted: (_questionId, usedModel) => onRunning((turnId) => dispatch({ type: 'started', turnId, model: usedModel })),
    onStep: (step) => onRunning((turnId) => dispatch({ type: 'step', turnId, step })),
    onAnswerDelta: (text) => onRunning((turnId) => dispatch({ type: 'delta', turnId, text })),
    onAnswerReset: () => onRunning((turnId) => dispatch({ type: 'reset', turnId })),
    onSpeech: (text) => {
      if (running.current) running.current.speech = text;
    },
    onAnswer: (answer, usage) => {
      onRunning((turnId) => dispatch({ type: 'answered', turnId, answer, usage }));
      settle((turnId, speech) => ({ status: 'done', turnId, answer, speech }));
    },
    onError: (error) => {
      const failure = turnError(error);
      onRunning((turnId) => dispatch({ type: 'failed', turnId, error: failure }));
      settle((turnId) => ({ status: error.code === 'stopped' ? 'stopped' : 'error', turnId, error: failure }));
    },
  };
  const { ask: askStream } = useAskStream(sessionId, handlers);

  const run = useCallback(
    (turnId: string, question: string, spoken: boolean) =>
      new Promise<TurnEnd>((resolve) => {
        running.current = { turnId, controller: null, speech: null, settle: resolve };
        const controller = askStream(question, latest.current.model, spoken);
        if (running.current?.turnId === turnId) running.current.controller = controller;
      }),
    [askStream],
  );

  const ask = useCallback(
    (question: string, options: AskOptions = {}): Promise<TurnEnd> => {
      const text = question.trim();
      if (text === '' || running.current) return Promise.resolve({ status: 'busy' });
      const turnId = `turn-${++nextId.current}`;
      const spoken = options.spoken === true;
      dispatch({ type: 'asked', turnId, question: text, spoken });
      return run(turnId, text, spoken);
    },
    [run],
  );

  const retry = useCallback(
    (turnId: string) => {
      if (running.current) return;
      const all = latest.current.turns;
      const turn = all.find((candidate) => candidate.id === turnId);
      if (!turn) return;
      if (all.at(-1)?.id !== turnId) return void ask(turn.question);
      dispatch({ type: 'retried', turnId });
      void run(turnId, turn.question, false);
    },
    [ask, run],
  );

  const stop = useCallback(() => running.current?.controller?.stop(), []);

  const noteSaid = useCallback((turnId: string, text: string) => dispatch({ type: 'said', turnId, text }), []);

  const { mutateAsync: forget, isPending: clearing } = clearChat;
  const clear = useCallback(async () => {
    running.current?.controller?.stop();
    await forget(sessionId);
    dispatch({ type: 'cleared' });
    startNewSession();
  }, [forget, sessionId, startNewSession]);

  const value = useMemo<ChatContextValue>(
    () => ({ turns, streaming: isStreaming(turns), ask, retry, stop, noteSaid, clear, clearing }),
    [turns, ask, retry, stop, noteSaid, clear, clearing],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

function turnError(error: ApiError): TurnError {
  return { code: error.code, message: error.message, retryAfterSeconds: error.retryAfterSeconds };
}
