import { z } from 'zod';
import { Answer } from './answer';
import { ErrorDetail } from './errors';
import { Usage } from './models';

export const ChatRequest = z.object({
  sessionId: z.string().min(1).max(100),
  question: z.string().trim().min(1).max(4000),
  model: z.string().nullable().optional(),
  /** True when the question was spoken in a voice call: a short text to read aloud then comes before the answer. */
  spoken: z.boolean().optional(),
});
export type ChatRequest = z.infer<typeof ChatRequest>;

export const ToolStepStatus = z.enum(['running', 'ok', 'error', 'refused']);
export type ToolStepStatus = z.infer<typeof ToolStepStatus>;

/** One tool call in the "How I found this" trace. Sent when it starts and again when it ends. */
export const ToolStep = z.object({
  id: z.string(),
  name: z.string(),
  inputSummary: z.string(),
  status: ToolStepStatus,
  durationMs: z.number().int().nullable(),
  resultSummary: z.string().nullable(),
  error: z.string().nullable(),
});
export type ToolStep = z.infer<typeof ToolStep>;

/** Server-sent events on POST /api/chat, one JSON object per `data:` line. */
export const ChatEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('started'), questionId: z.string(), model: z.string() }),
  z.object({ type: z.literal('step'), step: ToolStep }),
  z.object({ type: z.literal('answer_delta'), delta: z.string() }),
  z.object({ type: z.literal('answer_reset') }),
  /** What a voice call says aloud for the answer that follows; only for spoken questions. */
  z.object({ type: z.literal('speech'), text: z.string() }),
  z.object({ type: z.literal('answer'), answer: Answer, usage: Usage }),
  z.object({ type: z.literal('error'), error: ErrorDetail }),
]);
export type ChatEvent = z.infer<typeof ChatEvent>;
