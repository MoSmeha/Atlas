import OpenAI from 'openai';
import { errors } from '../../application/errors';

/** One shared SDK client: two quick retries, two minutes per request. Throws missing_api_key without a key. */
export function createOpenAiClient(apiKey: string | null): OpenAI {
  if (apiKey === null) throw errors.missingOpenAiKey();
  return new OpenAI({ apiKey, maxRetries: 2, timeout: 120_000 });
}
