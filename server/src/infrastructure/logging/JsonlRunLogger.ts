import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Clock } from '../../application/ports/Clock';
import type {
  IndexLogEntry,
  QuestionLogEntry,
  RunLogger,
  ToolLogEntry,
  VoiceLogEntry,
} from '../../application/ports/RunLogger';

/** Appends one JSON line per event to `<logDir>/<date>.jsonl`. Logging never breaks a question. */
export class JsonlRunLogger implements RunLogger {
  private readonly logDir: string;
  private readonly clock: Clock;

  constructor(logDir: string, clock: Clock) {
    this.logDir = logDir;
    this.clock = clock;
  }

  tool(entry: ToolLogEntry): void {
    this.write('tool', entry);
  }

  question(entry: QuestionLogEntry): void {
    this.write('question', entry);
  }

  indexing(entry: IndexLogEntry): void {
    this.write('indexing', entry);
  }

  voice(entry: VoiceLogEntry): void {
    this.write('voice', entry);
  }

  private write(type: string, entry: object): void {
    const now = this.clock.now();
    try {
      mkdirSync(this.logDir, { recursive: true });
      const file = join(this.logDir, `${now.toISOString().slice(0, 10)}.jsonl`);
      appendFileSync(file, `${JSON.stringify({ type, at: now.toISOString(), ...entry })}\n`);
    } catch (error) {
      console.warn(`Could not write to the log folder ${this.logDir}:`, error);
    }
  }
}
