import { useContext } from 'react';
import { SessionContext, type SessionValue } from './SessionContext';

/** The session id and the chosen model. Call it inside SessionProvider. */
export function useSession(): SessionValue {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession needs a SessionProvider above it.');
  return session;
}
