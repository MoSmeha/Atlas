import { Session } from './Session';

export class SessionStore {
  private readonly sessions = new Map<string, Session>();

  /** Returns the session, starting a new one the first time an id is seen. */
  get(id: string): Session {
    let session = this.sessions.get(id);
    if (!session) {
      session = new Session(id);
      this.sessions.set(id, session);
    }
    return session;
  }

  /** The session if it has been started, without starting one. */
  find(id: string): Session | null {
    return this.sessions.get(id) ?? null;
  }

  clear(id: string): void {
    this.sessions.delete(id);
  }
}
