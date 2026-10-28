import type { Answer, Source, Usage } from '@atlas/shared';
import type { CleanValue } from '../../domain/table';

/** Rows a tool computed, kept under an id so the answer, export_table and calculate can reuse them. */
export interface SavedResult {
  id: string;
  title: string | null;
  columns: string[];
  rows: CleanValue[][];
  sources: Source[];
  /** Tool that produced the rows. */
  tool: string;
  /** For example the SQL that produced them. */
  detail: string | null;
}

export interface Turn {
  question: string;
  answer: Answer;
}

/** One chat: its turns, its saved results and its spend. Lives in memory for the server's lifetime. */
export class Session {
  readonly id: string;
  readonly turns: Turn[] = [];
  lastUsage: Usage | null = null;
  totalCostUsd = 0;
  private readonly results = new Map<string, SavedResult>();
  private nextResult = 1;

  constructor(id: string) {
    this.id = id;
  }

  saveResult(result: Omit<SavedResult, 'id'>): SavedResult {
    const saved = { ...result, id: `r${this.nextResult++}` };
    this.results.set(saved.id, saved);
    return saved;
  }

  result(id: string): SavedResult | null {
    return this.results.get(id) ?? null;
  }

  addTurn(turn: Turn, usage: Usage): void {
    this.turns.push(turn);
    this.lastUsage = usage;
    this.totalCostUsd += usage.costUsd;
  }

  recentTurns(count: number): Turn[] {
    return this.turns.slice(-count);
  }
}
