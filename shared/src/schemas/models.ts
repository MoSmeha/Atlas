import { z } from 'zod';

export const ModelTier = z.enum(['frontier', 'balanced', 'small']);
export type ModelTier = z.infer<typeof ModelTier>;

export const ModelOption = z.object({
  id: z.string(),
  tier: ModelTier,
  label: z.string(),
  /** US dollars per one million tokens. */
  inputPrice: z.number(),
  outputPrice: z.number(),
});
export type ModelOption = z.infer<typeof ModelOption>;

/** Who answers: OpenAI, Gemini's free tier, or a model on this computer through Ollama. */
export const ModelProvider = z.enum(['openai', 'gemini', 'ollama']);
export type ModelProvider = z.infer<typeof ModelProvider>;

export const ModelsResponse = z.object({
  models: z.array(ModelOption),
  defaultModel: z.string(),
  /** Null while no provider is set up. */
  provider: ModelProvider.nullable(),
});
export type ModelsResponse = z.infer<typeof ModelsResponse>;

/** Tokens, cost and time of one answered question. */
export const Usage = z.object({
  model: z.string(),
  inputTokens: z.number().int(),
  cachedInputTokens: z.number().int(),
  outputTokens: z.number().int(),
  reasoningTokens: z.number().int(),
  costUsd: z.number(),
  durationMs: z.number().int(),
});
export type Usage = z.infer<typeof Usage>;

export const UsageResponse = z.object({
  last: Usage.nullable(),
  /** costUsd includes voice calls and dictation; voiceSeconds is the length of this chat's calls. */
  session: z.object({ questions: z.number().int(), costUsd: z.number(), voiceSeconds: z.number().nonnegative() }),
});
export type UsageResponse = z.infer<typeof UsageResponse>;
