import { type ReactNode, useCallback, useMemo, useState } from 'react';
import type { AnswerEffort } from '@atlas/shared';
import { SessionContext, type SessionValue } from './SessionContext';
import { newSessionId } from './newSessionId';

/** Holds the session id and the chosen model and effort for this page load. A reload starts a new session. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState(newSessionId);
  const [model, setModel] = useState<string | null>(null);
  const [effort, setEffort] = useState<AnswerEffort | null>(null);
  const startNewSession = useCallback(() => setSessionId(newSessionId()), []);

  const value = useMemo<SessionValue>(
    () => ({ sessionId, model, setModel, effort, setEffort, startNewSession }),
    [sessionId, model, effort, startNewSession],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
