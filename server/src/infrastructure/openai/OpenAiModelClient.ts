import type OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import type { ResponseCreateParamsStreaming } from 'openai/resources/responses/responses';
import { errors } from '../../application/errors';
import type {
  ModelClient,
  ModelTurnRequest,
  ModelTurnResult,
  ObjectRequest,
} from '../../application/ports/ModelClient';
import type { TokenUsage } from '../../domain/pricing';
import { toResponseInput } from './inputItems';
import { mapOpenAiError } from './mapOpenAiError';
import { parseObject } from './parseObject';
import { readResponse } from './readResponse';
import { initialStreamState, reduceStreamEvent } from './streamEvents';
import { toFunctionTool } from './toolSchema';

const LIST_MODELS_TIMEOUT_MS = 8_000;

/** ModelClient on the OpenAI Responses API. Turns stream and chain through previous_response_id. */
export class OpenAiModelClient implements ModelClient {
  private readonly client: OpenAI;

  constructor(client: OpenAI) {
    this.client = client;
  }

  async turn(request: ModelTurnRequest): Promise<ModelTurnResult> {
    try {
      const stream = await this.client.responses.create(turnParams(request), { signal: request.signal });
      let state = initialStreamState;
      for await (const event of stream) {
        const step = reduceStreamEvent(state, event);
        state = step.state;
        for (const streamEvent of step.events) request.onEvent?.(streamEvent);
      }
      // The SDK ends the iteration quietly when the request is aborted mid-stream.
      if (request.signal?.aborted) throw errors.stopped();
      if (state.error !== null) throw errors.modelError(state.error);
      if (state.response === null) throw errors.modelError('the reply ended before it finished.');
      return readResponse(state.response);
    } catch (error) {
      throw request.signal?.aborted ? errors.stopped() : mapOpenAiError(error);
    }
  }

  async generateObject<T>(request: ObjectRequest<T>): Promise<{ value: T; usage: TokenUsage }> {
    try {
      const response = await this.client.responses.create(
        {
          model: request.model,
          instructions: request.instructions,
          input: typeof request.input === 'string' ? request.input : toResponseInput(request.input),
          text: { format: zodTextFormat(request.schema, request.schemaName) },
          store: false,
          ...(request.reasoningEffort ? { reasoning: { effort: request.reasoningEffort } } : {}),
        },
        { signal: request.signal },
      );
      const result = readResponse(response);
      if (result.refusal !== null) throw errors.modelRefusal(result.refusal);
      return { value: parseObject(request.schema, result.text), usage: result.usage };
    } catch (error) {
      throw request.signal?.aborted ? errors.stopped() : mapOpenAiError(error);
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const ids: string[] = [];
      for await (const model of this.client.models.list({ timeout: LIST_MODELS_TIMEOUT_MS, maxRetries: 0 })) {
        ids.push(model.id);
      }
      return ids;
    } catch (error) {
      throw mapOpenAiError(error);
    }
  }
}

/** Request body for one streamed turn. Instructions are sent every time: previous_response_id does not carry them. */
function turnParams(request: ModelTurnRequest): ResponseCreateParamsStreaming {
  const hasTools = request.tools.length > 0;
  return {
    model: request.model,
    instructions: request.instructions,
    input: toResponseInput(request.input),
    ...(hasTools
      ? {
          tools: request.tools.map(toFunctionTool),
          tool_choice:
            typeof request.toolChoice === 'string'
              ? request.toolChoice
              : { type: 'function', name: request.toolChoice.name },
          parallel_tool_calls: true,
        }
      : {}),
    ...(request.previousResponseId ? { previous_response_id: request.previousResponseId } : {}),
    ...(request.reasoningEffort ? { reasoning: { effort: request.reasoningEffort } } : {}),
    store: true,
    stream: true,
  };
}
