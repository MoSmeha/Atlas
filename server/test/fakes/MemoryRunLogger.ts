import type { IndexLogEntry, QuestionLogEntry, RunLogger, ToolLogEntry } from '../../src/application/ports/RunLogger';

export class MemoryRunLogger implements RunLogger {
  readonly tools: ToolLogEntry[] = [];
  readonly questions: QuestionLogEntry[] = [];
  readonly indexed: IndexLogEntry[] = [];

  tool(entry: ToolLogEntry): void {
    this.tools.push(entry);
  }

  question(entry: QuestionLogEntry): void {
    this.questions.push(entry);
  }

  indexing(entry: IndexLogEntry): void {
    this.indexed.push(entry);
  }
}
