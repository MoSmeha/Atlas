import type { Answer, Source, Usage } from '@atlas/shared';
import type { CleanValue } from '../../domain/table';
import { ScheduleCache } from '../schedule/ScheduleCache';
import { NumberEvidence } from './NumberEvidence';

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
  /** Ids of the results the tools saved while answering, in order, attached to the answer or not. */
  resultIds: string[];
}

/** One chat: its turns, its saved results and its spend. Lives in memory for the server's lifetime. */
export class Session {
  readonly id: string;
  readonly turns: Turn[] = [];
  lastUsage: Usage | null = null;
  /** Questions, voice calls and dictation together. */
  totalCostUsd = 0;
  /** Length of this chat's voice calls; their cost is in totalCostUsd. */
  voiceSeconds = 0;
  /** Seconds already counted per voice call, so a call reported twice is counted once. */
  private readonly calls = new Map<string, number>();
  /** Numbers seen in this chat; calculate checks its typed inputs against it. */
  readonly evidence = new NumberEvidence();
  /** What extract_schedule already read and checked in this chat. */
  readonly schedules = new ScheduleCache();
  private readonly results = new Map<string, SavedResult>();
  private nextResult = 1;

  constructor(id: string) {
    this.id = id;
  }

  saveResult(result: Omit<SavedResult, 'id'>): SavedResult {
    const saved = { ...result, id: `r${this.nextResult++}` };
    this.results.set(saved.id, saved);
    this.evidence.noteRows(saved.rows);
    return saved;
  }

  result(id: string): SavedResult | null {
    return this.results.get(id) ?? null;
  }

  /** Ids of every saved result, oldest first. */
  resultIds(): string[] {
    return [...this.results.keys()];
  }

  addTurn(turn: Turn, usage: Usage): void {
    this.turns.push(turn);
    this.lastUsage = usage;
    this.totalCostUsd += usage.costUsd;
  }

  /** Counts a voice call's length and cost. A call reported again adds only the seconds it grew by. */
  recordCall(callId: string, seconds: number, pricePerMinute: number): void {
    const counted = this.calls.get(callId) ?? 0;
    if (!(seconds > counted)) return;
    this.calls.set(callId, seconds);
    this.voiceSeconds += seconds - counted;
    this.totalCostUsd += ((seconds - counted) / 60) * pricePerMinute;
  }

  /** Spend that is not a question, such as a dictation. */
  addSpend(costUsd: number): void {
    this.totalCostUsd += costUsd;
  }

  recentTurns(count: number): Turn[] {
    return this.turns.slice(-count);
  }
}
