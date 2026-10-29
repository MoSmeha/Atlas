import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AnswerEffort } from '@atlas/shared';
import { ApiError } from './ApiError';
import { type AskHandlers, type AskOutcome, askQuestion, stoppedMessage } from './askQuestion';
import { queryKeys } from './queryKeys';

/** The model and effort a question goes to; null for either means the server's default. */
export interface AnswerChoice {
  model: string | null;
  effort: AnswerEffort | null;
}

export interface AskController {
  /** Stops the question. onError gets code "stopped" before this returns, and nothing follows it. */
  stop(): void;
  /** Settles once the question has ended, however it ended. */
  readonly finished: Promise<AskOutcome>;
}

interface Run {
  /** Ends the run without reporting anything more. */
  dispose(): void;
}

/**
 * Streams answers from POST /api/chat into the handlers, always using the latest ones passed.
 * Asking again, or unmounting, silently ends a question that is still running; call stop()
 * first to have it reported as stopped. The usage query refreshes whenever a question ends.
 */
export function useAskStream(sessionId: string, handlers: AskHandlers) {
  const queryClient = useQueryClient();
  const handlersRef = useRef(handlers);
  const running = useRef<Run | null>(null);

  useEffect(() => {
    handlersRef.current = handlers;
  });
  useEffect(() => () => running.current?.dispose(), []);

  const ask = useCallback(
    (question: string, { model, effort }: AnswerChoice, spoken = false): AskController => {
      running.current?.dispose();
      const controller = new AbortController();
      let open = true;
      let ended = false;
      const run: Run = {
        dispose: () => {
          open = false;
          controller.abort();
        },
      };
      running.current = run;

      const current = (): AskHandlers => (open ? handlersRef.current : {});
      const end = () => {
        if (ended) return;
        ended = true;
        open = false;
        if (running.current === run) running.current = null;
        void queryClient.invalidateQueries({ queryKey: queryKeys.usage(sessionId) });
      };
      const report: AskHandlers = {
        onStarted: (questionId, usedModel) => current().onStarted?.(questionId, usedModel),
        onStep: (step) => current().onStep?.(step),
        onAnswerDelta: (delta) => current().onAnswerDelta?.(delta),
        onAnswerReset: () => current().onAnswerReset?.(),
        onSpeech: (text) => current().onSpeech?.(text),
        onAnswer: (answer, usage) => {
          current().onAnswer?.(answer, usage);
          end();
        },
        onError: (error) => {
          current().onError?.(error);
          end();
        },
      };

      const finished = askQuestion({ sessionId, question, model, effort, ...(spoken ? { spoken } : {}) }, report, controller.signal);
      return {
        stop: () => {
          if (!open) return;
          report.onError?.(new ApiError('stopped', stoppedMessage));
          controller.abort();
        },
        finished,
      };
    },
    [queryClient, sessionId],
  );

  return { ask };
}
