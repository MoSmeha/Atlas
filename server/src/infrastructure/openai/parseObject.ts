import type { z } from 'zod';
import { errors } from '../../application/errors';

/** Reads a structured reply: JSON that must match the schema, or model_error. */
export function parseObject<T>(schema: z.ZodType<T>, text: string): T {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw errors.modelError('the reply was not valid JSON.');
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw errors.modelError('the reply did not match the expected format.');
  return parsed.data;
}
