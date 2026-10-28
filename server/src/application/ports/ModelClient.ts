import type { z } from 'zod';
import type { TokenUsage } from '../../domain/pricing';

export type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/** A function tool the model may call. The adapter turns the Zod object into a strict JSON schema. */
export interface ToolSpec {
  name: string;
  description: string;
  parameters: z.ZodObject;
}

export type ContentPart = { type: 'text'; text: string } | { type: 'image'; pngBase64: string };

export type InputItem =
  | { type: 'message'; role: 'user' | 'assistant'; content: string | ContentPart[] }
  | { type: 'tool_output'; callId: string; output: string };

export interface FunctionCall {
  callId: string;
  name: string;
  /** JSON text exactly as the model wrote it; the loop validates it. */
  arguments: string;
}

export type ModelStreamEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_call_started'; callId: string; name: string }
  | { type: 'tool_arguments_delta'; callId: string; name: string; delta: string };

export interface ModelTurnRequest {
  model: string;
  instructions: string;
  input: InputItem[];
  tools: ToolSpec[];
  toolChoice: 'auto' | 'required' | { name: string };
  /** Continue from this response so reasoning carries across tool calls; send only new items. */
  previousResponseId: string | null;
  reasoningEffort: ReasoningEffort | null;
  signal?: AbortSignal;
  onEvent?: (event: ModelStreamEvent) => void;
}

export interface ModelTurnResult {
  responseId: string;
  text: string;
  functionCalls: FunctionCall[];
  refusal: string | null;
  usage: TokenUsage;
}

export interface ObjectRequest<T> {
  model: string;
  instructions: string;
  input: string | InputItem[];
  schema: z.ZodType<T>;
  schemaName: string;
  reasoningEffort?: ReasoningEffort | null;
  signal?: AbortSignal;
}

/**
 * The language model. Adapters throw AppError with codes missing_api_key, rate_limited,
 * model_refusal, model_error or stopped, never SDK errors.
 */
export interface ModelClient {
  /** One streamed model call with tools. */
  turn(request: ModelTurnRequest): Promise<ModelTurnResult>;
  /** One call whose output must match the schema. */
  generateObject<T>(request: ObjectRequest<T>): Promise<{ value: T; usage: TokenUsage }>;
  /** IDs of the models this account can use. */
  listModels(): Promise<string[]>;
}
