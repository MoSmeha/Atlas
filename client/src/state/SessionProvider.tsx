import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { SessionContext, type SessionValue } from './SessionContext';
import { newSessionId } from './newSessionId';

/** Holds the session id and the chosen model for this page load. A reload starts a new session. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState(newSessionId);
  const [model, setModel] = useState<string | null>(null);
  const startNewSession = useCallback(() => setSessionId(newSessionId()), []);

  const value = useMemo<SessionValue>(
    () => ({ sessionId, model, setModel, startNewSession }),
    [sessionId, model, startNewSession],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
