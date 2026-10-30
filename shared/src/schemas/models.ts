import { z } from 'zod';

export const ModelTier = z.enum(['frontier', 'balanced', 'small']);
export type ModelTier = z.infer<typeof ModelTier>;

/** Who answers: OpenAI, Gemini's free tier, or a model on this computer through Ollama. */
export const ModelProvider = z.enum(['openai', 'gemini', 'ollama']);
export type ModelProvider = z.infer<typeof ModelProvider>;

/** How long the answer model thinks before it answers: low is the fastest, high the slowest and most careful. */
export const AnswerEffort = z.enum(['low', 'medium', 'high']);
export type AnswerEffort = z.infer<typeof AnswerEffort>;

export const ModelOption = z.object({
  id: z.string(),
  provider: ModelProvider,
  tier: ModelTier,
  label: z.string(),
  /** US dollars per one million tokens. */
  inputPrice: z.number(),
  outputPrice: z.number(),
  /** The effort it answers at unless one is picked; null when its provider leaves thinking to the model, so none can be. */
  defaultEffort: AnswerEffort.nullable(),
});
export type ModelOption = z.infer<typeof ModelOption>;

export const ModelsResponse = z.object({
  /** Every provider that is set up, side by side, provider by provider. */
  models: z.array(ModelOption),
  defaultModel: z.string(),
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
