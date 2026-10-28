import { numbersFromValue } from '../../domain/numbers';
import { numbersInText } from '../../domain/numbersInText';
import type { CleanValue } from '../../domain/table';

/**
 * Numbers a chat has seen in its questions, tool outputs and saved results.
 * calculate accepts a typed number only when it is here, so the model cannot invent inputs.
 */
export class NumberEvidence {
  private readonly seen = new Set<number>();

  /** Notes every number written in a text, such as the user's question or a tool output. */
  noteText(text: string): void {
    for (const value of numbersInText(text)) this.noteNumber(value);
  }

  /** Notes every number a JSON value holds, such as a tool output: its number values and the numbers in its strings. */
  noteValue(value: unknown): void {
    for (const number of numbersFromValue(value)) this.noteNumber(number);
  }

  noteNumber(value: number): void {
    if (!Number.isFinite(value)) return;
    const unsigned = Math.abs(value);
    this.seen.add(unsigned);
    this.seen.add(Number(unsigned.toPrecision(15)));
  }

  /** Notes number cells, and numbers written inside text cells. */
  noteRows(rows: readonly (readonly CleanValue[])[]): void {
    for (const row of rows) {
      for (const cell of row) {
        if (typeof cell === 'number') this.noteNumber(cell);
        else if (typeof cell === 'string') this.noteText(cell);
      }
    }
  }

  /** Whether the number, ignoring its sign, has been seen. */
  has(value: number): boolean {
    return this.seen.has(Math.abs(value));
  }
}
