import { createContext } from 'react';

/** The chat session the page is in and the model the next question goes to. */
export interface SessionValue {
  /** Sent with every question, usage request and export. A new one starts after Clear chat. */
  sessionId: string;
  /** The model the user picked; null means the server's default. */
  model: string | null;
  setModel(model: string | null): void;
  /** Switches to a fresh session id. The model choice stays. */
  startNewSession(): void;
}

export const SessionContext = createContext<SessionValue | null>(null);
