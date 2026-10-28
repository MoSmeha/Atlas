import { type Answer, ChatEvent, type ChatRequest, type ToolStep, type Usage, routes } from '@atlas/shared';
import { ApiError, isAbortError, toApiError } from './ApiError';
import { send } from './http';
import { streamEvents } from './sse';

/** What the chat state hears while a question runs. Every question ends with one onAnswer or one onError. */
export interface AskHandlers {
  onStarted?(questionId: string, model: string): void;
  /** A tool call started or ended; a step id arrives again when its status changes. */
  onStep?(step: ToolStep): void;
  onAnswerDelta?(delta: string): void;
  /** Discard the text streamed so far; a corrected answer follows. */
  onAnswerReset?(): void;
  onAnswer?(answer: Answer, usage: Usage): void;
  /** A server, model or connection failure; Stop arrives here too, with code "stopped". */
  onError?(error: ApiError): void;
}

export type AskOutcome = 'answered' | 'failed' | 'stopped';

export const stoppedMessage = 'Stopped. Atlas did not finish this answer.';

const cutOffMessage = 'The connection to Atlas closed before the answer was finished. Ask again.';

/** Posts a question to /api/chat and reports each streamed event. Aborting the signal stops it. */
export async function askQuestion(request: ChatRequest, handlers: AskHandlers, signal: AbortSignal): Promise<AskOutcome> {
  try {
    const response = await send(routes.chat, { method: 'POST', body: request, accept: 'text/event-stream', signal });
    for await (const event of streamEvents(response, ChatEvent)) {
      const outcome = deliver(event, handlers);
      if (outcome) return outcome;
    }
    if (signal.aborted) return stopped(handlers);
    handlers.onError?.(new ApiError('unreachable', cutOffMessage));
    return 'failed';
  } catch (error) {
    if (signal.aborted || isAbortError(error)) return stopped(handlers);
    handlers.onError?.(toApiError(error));
    return 'failed';
  }
}

/** Hands one event to its handler; returns the outcome when the event ends the question. */
function deliver(event: ChatEvent, handlers: AskHandlers): AskOutcome | null {
  switch (event.type) {
    case 'started':
      handlers.onStarted?.(event.questionId, event.model);
      return null;
    case 'step':
      handlers.onStep?.(event.step);
      return null;
    case 'answer_delta':
      handlers.onAnswerDelta?.(event.delta);
      return null;
    case 'answer_reset':
      handlers.onAnswerReset?.();
      return null;
    case 'answer':
      handlers.onAnswer?.(event.answer, event.usage);
      return 'answered';
    case 'error':
      handlers.onError?.(ApiError.fromDetail(event.error));
      return event.error.code === 'stopped' ? 'stopped' : 'failed';
  }
}

function stopped(handlers: AskHandlers): AskOutcome {
  handlers.onError?.(new ApiError('stopped', stoppedMessage));
  return 'stopped';
}
