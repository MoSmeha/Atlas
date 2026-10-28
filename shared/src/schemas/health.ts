import { z } from 'zod';

export const HealthResponse = z.object({
  ok: z.literal(true),
  version: z.string(),
  apiKeyPresent: z.boolean(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;
