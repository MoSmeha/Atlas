import type { Answer, ToolStep, Usage } from '@atlas/shared';
import type { ApiErrorCode } from '../../api/ApiError';

export type TurnStatus = 'streaming' | 'done' | 'error' | 'stopped';

/** Why a turn ended without an answer, with a message fit to show. */
export interface TurnError {
  code: ApiErrorCode;
  message: string;
  retryAfterSeconds: number | null;
}

/** One question and everything Atlas sent back for it. */
export interface Turn {
  id: string;
  question: string;
  status: TurnStatus;
  /** The answer text as it streams in; the final answer's markdown once that arrives. */
  markdown: string;
  /** Tool calls in the order they started. A step sent again replaces its earlier version. */
  steps: ToolStep[];
  /** The model the server used, once it says. */
  model: string | null;
  answer: Answer | null;
  usage: Usage | null;
  error: TurnError | null;
}

export type ChatAction =
  | { type: 'asked'; turnId: string; question: string }
  | { type: 'retried'; turnId: string }
  | { type: 'started'; turnId: string; model: string }
  | { type: 'step'; turnId: string; step: ToolStep }
  | { type: 'delta'; turnId: string; text: string }
  | { type: 'reset'; turnId: string }
  | { type: 'answered'; turnId: string; answer: Answer; usage: Usage }
  | { type: 'failed'; turnId: string; error: TurnError }
  | { type: 'cleared' };

export const noTurns: Turn[] = [];

/** The chat's turns, oldest first. Events for a turn that is no longer streaming are ignored. */
export function chatReducer(turns: Turn[], action: ChatAction): Turn[] {
  switch (action.type) {
    case 'asked':
      return [...turns, freshTurn(action.turnId, action.question)];
    case 'retried':
      return update(turns, action.turnId, (turn) => freshTurn(turn.id, turn.question), true);
    case 'started':
      return update(turns, action.turnId, (turn) => ({ ...turn, model: action.model }));
    case 'step':
      return update(turns, action.turnId, (turn) => ({ ...turn, steps: upsertStep(turn.steps, action.step) }));
    case 'delta':
      return update(turns, action.turnId, (turn) => ({ ...turn, markdown: turn.markdown + action.text }));
    case 'reset':
      return update(turns, action.turnId, (turn) => ({ ...turn, markdown: '' }));
    case 'answered':
      return update(turns, action.turnId, (turn) => ({
        ...turn,
        status: 'done',
        markdown: action.answer.markdown,
        answer: action.answer,
        usage: action.usage,
      }));
    case 'failed':
      return update(turns, action.turnId, (turn) => ({
        ...turn,
        status: action.error.code === 'stopped' ? 'stopped' : 'error',
        error: action.error,
      }));
    case 'cleared':
      return noTurns;
  }
}

/** True while the newest turn is still streaming. */
export function isStreaming(turns: Turn[]): boolean {
  return turns.at(-1)?.status === 'streaming';
}

function freshTurn(id: string, question: string): Turn {
  return { id, question, status: 'streaming', markdown: '', steps: [], model: null, answer: null, usage: null, error: null };
}

function upsertStep(steps: ToolStep[], step: ToolStep): ToolStep[] {
  const index = steps.findIndex((known) => known.id === step.id);
  if (index === -1) return [...steps, step];
  return steps.with(index, step);
}

/** Applies `change` to one turn. Only a streaming turn changes, unless `anyStatus` is set. */
function update(turns: Turn[], turnId: string, change: (turn: Turn) => Turn, anyStatus = false): Turn[] {
  const index = turns.findIndex((turn) => turn.id === turnId);
  const turn = turns[index];
  if (!turn || (!anyStatus && turn.status !== 'streaming')) return turns;
  return turns.with(index, change(turn));
}
