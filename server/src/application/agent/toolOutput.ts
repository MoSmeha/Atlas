import { sliceText } from '../../domain/text';
import { agentMessages } from './agentMessages';

/** Longest tool output the model gets, in characters; longer output is cut with a note. */
export const MAX_OUTPUT_CHARS = 20_000;

/** A tool result as JSON text. Throws when the value cannot be written as JSON. */
export function toJsonText(output: unknown): string {
  const text = JSON.stringify(output);
  if (text === undefined) throw new Error('the result could not be written as JSON.');
  return text;
}

/** The text as the model gets it: whole, or cut to MAX_OUTPUT_CHARS with a note on how to ask for less. */
export function capOutput(text: string, max = MAX_OUTPUT_CHARS): string {
  if (text.length <= max) return text;
  const kept = sliceText(text, max);
  return `${kept}\n${agentMessages.truncated(kept.length, text.length)}`;
}

/** Adds a line for the model after a tool output. */
export function withNotice(output: string, notice: string): string {
  return `${output}\n\n${notice}`;
}
