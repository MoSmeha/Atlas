import { z } from 'zod';
import { agentMessages } from './agentMessages';

export type ParsedArguments =
  | { ok: true; args: Record<string, unknown>; json: unknown }
  | {
      ok: false;
      /** Sent back to the model as the call's output: what is wrong, plus the input it sent, to fix. */
      error: string;
      /** The parsed JSON, or the raw text when it was not valid JSON. */
      json: unknown;
    };

/** Reads the JSON text of a function call and checks it against the tool's parameters. */
export function parseArguments(text: string, parameters: z.ZodObject): ParsedArguments {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    return { ok: false, error: agentMessages.invalidJson(error instanceof Error ? error.message : String(error)), json: text };
  }
  const parsed = parameters.safeParse(json);
  if (!parsed.success) return { ok: false, error: agentMessages.invalidArguments(z.prettifyError(parsed.error)), json };
  return { ok: true, args: parsed.data, json };
}
