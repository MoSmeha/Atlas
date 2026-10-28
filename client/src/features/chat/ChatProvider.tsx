import { type ReactNode, useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type { ApiError } from '../../api/ApiError';
import type { AskHandlers } from '../../api/askQuestion';
import { type AskController, useAskStream } from '../../api/useAskStream';
import { useClearChat } from '../../api/useClearChat';
import { useSession } from '../../state/useSession';
import { ChatContext, type ChatContextValue } from './ChatContext';
import { type TurnError, chatReducer, isStreaming, noTurns } from './chatReducer';

interface Running {
  turnId: string;
  controller: AskController | null;
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
  const handlers: AskHandlers = {
    onStarted: (_questionId, usedModel) => onRunning((turnId) => dispatch({ type: 'started', turnId, model: usedModel })),
    onStep: (step) => onRunning((turnId) => dispatch({ type: 'step', turnId, step })),
    onAnswerDelta: (text) => onRunning((turnId) => dispatch({ type: 'delta', turnId, text })),
    onAnswerReset: () => onRunning((turnId) => dispatch({ type: 'reset', turnId })),
    onAnswer: (answer, usage) => {
      onRunning((turnId) => dispatch({ type: 'answered', turnId, answer, usage }));
      running.current = null;
    },
    onError: (error) => {
      onRunning((turnId) => dispatch({ type: 'failed', turnId, error: turnError(error) }));
      running.current = null;
    },
  };
  const { ask: askStream } = useAskStream(sessionId, handlers);

  const run = useCallback(
    (turnId: string, question: string) => {
      running.current = { turnId, controller: null };
      const controller = askStream(question, latest.current.model);
      if (running.current?.turnId === turnId) running.current.controller = controller;
    },
    [askStream],
  );

  const ask = useCallback(
    (question: string) => {
      const text = question.trim();
      if (text === '' || running.current) return;
      const turnId = `turn-${++nextId.current}`;
      dispatch({ type: 'asked', turnId, question: text });
      run(turnId, text);
    },
    [run],
  );

  const retry = useCallback(
    (turnId: string) => {
      if (running.current) return;
      const all = latest.current.turns;
      const turn = all.find((candidate) => candidate.id === turnId);
      if (!turn) return;
      if (all.at(-1)?.id !== turnId) return ask(turn.question);
      dispatch({ type: 'retried', turnId });
      run(turnId, turn.question);
    },
    [ask, run],
  );

  const stop = useCallback(() => running.current?.controller?.stop(), []);

  const { mutateAsync: forget, isPending: clearing } = clearChat;
  const clear = useCallback(async () => {
    running.current?.controller?.stop();
    await forget(sessionId);
    dispatch({ type: 'cleared' });
    startNewSession();
  }, [forget, sessionId, startNewSession]);

  const value = useMemo<ChatContextValue>(
    () => ({ turns, streaming: isStreaming(turns), ask, retry, stop, clear, clearing }),
    [turns, ask, retry, stop, clear, clearing],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

function turnError(error: ApiError): TurnError {
  return { code: error.code, message: error.message, retryAfterSeconds: error.retryAfterSeconds };
}
