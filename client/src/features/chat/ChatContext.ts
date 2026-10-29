import { createContext } from 'react';
import type { Answer } from '@atlas/shared';
import type { Turn, TurnError } from './chatReducer';

export interface AskOptions {
  /** Asked aloud in a voice call: the server also sends what to say about the answer. */
  spoken?: boolean;
}

/** How a question ended. "busy" means it was not asked, because another one was still being answered. */
export type TurnEnd =
  | { status: 'done'; turnId: string; answer: Answer; /** What to say aloud; null unless the question was spoken. */ speech: string | null }
  | { status: 'error' | 'stopped'; turnId: string; error: TurnError }
  | { status: 'busy' };

/** The conversation and its controls, shared by the thread, the composer, the voice call and the top bar. */
export interface ChatContextValue {
  /** Oldest first. */
  turns: Turn[];
  /** True while the newest question is still being answered. */
  streaming: boolean;
  /** Sends a question and settles once it ends; ignored, settling as "busy", while another one is still streaming. */
  ask(question: string, options?: AskOptions): Promise<TurnEnd>;
  /** Asks a turn's question again: in place when it is the newest turn, as a new turn otherwise. */
  retry(turnId: string): void;
  /** Stops the streaming question; its turn keeps what arrived and is marked stopped. */
  stop(): void;
  /** Adds to what Atlas said aloud about a turn's answer in a voice call. */
  noteSaid(turnId: string, text: string): void;
  /**
   * Forgets the chat on the server, empties the thread and starts a new session id.
   * Rejects with an ApiError when the server cannot, and the thread stays as it was.
   */
  clear(): Promise<void>;
  clearing: boolean;
}

export const ChatContext = createContext<ChatContextValue | null>(null);
