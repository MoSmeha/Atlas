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

  clear(id: string): void {
    this.sessions.delete(id);
  }
}
