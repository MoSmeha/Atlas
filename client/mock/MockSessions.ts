import type { ResultTable, Usage, UsageResponse } from '@atlas/shared';

interface MockSession {
  last: Usage | null;
  questions: number;
  costUsd: number;
  results: Map<string, ResultTable>;
  nextResult: number;
}

/** Chats by session id: spend and the result tables answers attached, for usage and exports. */
export class MockSessions {
  private readonly sessions = new Map<string, MockSession>();

  private get(id: string): MockSession {
    let session = this.sessions.get(id);
    if (!session) {
      session = { last: null, questions: 0, costUsd: 0, results: new Map(), nextResult: 1 };
      this.sessions.set(id, session);
    }
    return session;
  }

  nextResultId(id: string): string {
    const session = this.get(id);
    return `r${session.nextResult++}`;
  }

  saveResult(id: string, table: ResultTable): void {
    this.get(id).results.set(table.resultId, table);
  }

  result(id: string, resultId: string): ResultTable | null {
    return this.get(id).results.get(resultId) ?? null;
  }

  record(id: string, usage: Usage): void {
    const session = this.get(id);
    session.last = usage;
    session.questions += 1;
    session.costUsd += usage.costUsd;
  }

  usage(id: string): UsageResponse {
    const session = this.get(id);
    return { last: session.last, session: { questions: session.questions, costUsd: session.costUsd } };
  }

  clear(id: string): void {
    this.sessions.delete(id);
  }
}
