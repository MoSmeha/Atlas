import type { ModelStreamEvent } from '../ports/ModelClient';
import type { AgentEvent } from './events';
import { StringFieldExtractor } from './partialJson';

/** Field of the submit tool's arguments that holds the answer text the user sees. */
export const ANSWER_FIELD = 'markdown';

/**
 * Turns one model turn's stream events into answer_delta events: the text of the `markdown` field of the
 * first submit call in the turn, as it is written. Use a new one for every turn.
 */
export function streamAnswer(submitTool: string, onEvent: (event: AgentEvent) => void): (event: ModelStreamEvent) => void {
  const extractor = new StringFieldExtractor(ANSWER_FIELD);
  let callId: string | null = null;
  return (event) => {
    if (event.type === 'text_delta' || event.name !== submitTool) return;
    callId ??= event.callId;
    if (event.type !== 'tool_arguments_delta' || event.callId !== callId) return;
    const delta = extractor.push(event.delta);
    if (delta !== '') onEvent({ type: 'answer_delta', delta });
  };
}
