import type { ChatEvent } from '@atlas/shared';

/**
 * What the agent loop reports while it works: a tool step starting or ending, a piece of the answer
 * being written, or the streamed answer being thrown away because it was rejected.
 * The shapes are the ChatEvent ones, so the chat route forwards them unchanged.
 */
export type AgentEvent = Extract<ChatEvent, { type: 'step' | 'answer_delta' | 'answer_reset' }>;
