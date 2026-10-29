import type { CallDiagnosis } from '@atlas/shared';
import type { TokenUsage } from '../../domain/pricing';
import type { ReasoningEffort } from './ModelClient';

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
  /** The effort the answer model ran at; null when the provider leaves thinking to each model. */
  reasoningEffort: ReasoningEffort | null;
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
  /** voice_design: a designed voice was made ahead of its first call, and `seconds` is how long that took. */
  event: 'call_start' | 'call_end' | 'dictation' | 'voice_design';
  /** Null for a voice design. */
  sessionId: string | null;
  /** Null for a dictation or a voice design, and for a call that never started. */
  callId: string | null;
  /** The catalog voice; null for a dictation. */
  voice: string | null;
  seconds: number;
  costUsd: number;
  error: string | null;
  /** What the browser measured about the call's audio, on call_end; null otherwise or when it never connected. */
  diagnosis: CallDiagnosis | null;
}

/** Writes what happened to local log files so a bad answer can be explained afterwards. */
export interface RunLogger {
  tool(entry: ToolLogEntry): void;
  question(entry: QuestionLogEntry): void;
  indexing(entry: IndexLogEntry): void;
  voice(entry: VoiceLogEntry): void;
}
