import { z } from 'zod';

export const HealthResponse = z.object({
  ok: z.literal(true),
  version: z.string(),
  /** True when a model provider is set up: an OpenAI or Gemini key, or a local Ollama this machine can run. */
  apiKeyPresent: z.boolean(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;
