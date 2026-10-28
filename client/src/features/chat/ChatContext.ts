import { createContext } from 'react';
import type { Turn } from './chatReducer';

/** The conversation and its controls, shared by the thread, the composer and the top bar. */
export interface ChatContextValue {
  /** Oldest first. */
  turns: Turn[];
  /** True while the newest question is still being answered. */
  streaming: boolean;
  /** Sends a question; ignored while another one is still streaming. */
  ask(question: string): void;
  /** Asks a turn's question again: in place when it is the newest turn, as a new turn otherwise. */
  retry(turnId: string): void;
  /** Stops the streaming question; its turn keeps what arrived and is marked stopped. */
  stop(): void;
  /** Forgets the chat on the server, then empties the thread. Rejects with an ApiError when the server cannot. */
  clear(): Promise<void>;
  clearing: boolean;
  /** The model the next question uses; null means the server's default. */
  model: string | null;
  setModel(model: string | null): void;
}

export const ChatContext = createContext<ChatContextValue | null>(null);
