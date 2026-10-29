import type { TokenUsage } from '../../domain/pricing';

export interface ToolLogEntry {
  questionId: string;
  tool: string;
  inputSummary: string;
  durationMs: number;
  resultBytes: number;
  error: string | null;
}

export interface QuestionLogEntry {
  questionId: string;
  sessionId: string;
  question: string;
  model: string;
  rounds: number;
  usage: TokenUsage;
  costUsd: number;
  durationMs: number;
  answerKind: string | null;
  error: string | null;
}

export interface IndexLogEntry {
  folder: string;
  file: string;
  status: string;
  durationMs: number;
  detail: string | null;
}

export interface VoiceLogEntry {
  event: 'call_start' | 'call_end' | 'dictation';
  sessionId: string;
  /** Null for a dictation, and for a call that never started. */
  callId: string | null;
  /** The catalog voice; null for a dictation. */
  voice: string | null;
  seconds: number;
  costUsd: number;
  error: string | null;
}

/** Writes what happened to local log files so a bad answer can be explained afterwards. */
export interface RunLogger {
  tool(entry: ToolLogEntry): void;
  question(entry: QuestionLogEntry): void;
  indexing(entry: IndexLogEntry): void;
  voice(entry: VoiceLogEntry): void;
}
