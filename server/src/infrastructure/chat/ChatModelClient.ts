import { randomUUID } from 'node:crypto';
import type OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import type { ChatCompletionCreateParamsStreaming, ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { CompletionUsage } from 'openai/resources/completions';
import { errors } from '../../application/errors';
import type {
  ModelClient,
  ModelTurnRequest,
  ModelTurnResult,
  ObjectRequest,
  ReasoningEffort,
} from '../../application/ports/ModelClient';
import type { TokenUsage } from '../../domain/pricing';
import { mapOpenAiError, type Vendor } from '../openai/mapOpenAiError';
import { parseObject } from '../openai/parseObject';
import { toChatMessages } from './chatInput';
import { assistantMessage, functionCalls, initialChatStreamState, reduceChatChunk, type ChatStreamState } from './chatStream';
import { toChatEffort, toChatTool, toChatToolChoice } from './chatTool';

const LIST_MODELS_TIMEOUT_MS = 8_000;
/** Conversations kept for a next turn. A question keeps one at a time, so this only bounds what failed runs leave. */
const MAX_CONVERSATIONS = 32;

export interface ChatModelClientOptions {
  vendor: Vendor;
  /**
   * Whether to send the requested reasoning effort. Ollama refuses it for models that do not think, so its turns
   * leave reasoning at each model's default.
   */
  sendsReasoning: boolean;
}

/**
 * ModelClient on the Chat Completions API, which Gemini, Ollama and other OpenAI-compatible servers speak. That
 * API keeps nothing between calls, so this client keeps each conversation itself: a turn's response id names the
 * messages so far, and the turn that continues it sends them all again. A conversation can be continued once.
 */
export class ChatModelClient implements ModelClient {
  private readonly client: OpenAI;
  private readonly options: ChatModelClientOptions;
  private readonly conversations = new Map<string, ChatCompletionMessageParam[]>();

  constructor(client: OpenAI, options: ChatModelClientOptions) {
    this.client = client;
    this.options = options;
  }

  async turn(request: ModelTurnRequest): Promise<ModelTurnResult> {
    try {
      const messages = [...this.history(request.previousResponseId), ...toChatMessages(request.input)];
      const stream = await this.client.chat.completions.create(this.turnParams(request, messages), { signal: request.signal });
      let state = initialChatStreamState;
      for await (const chunk of stream) {
        const step = reduceChatChunk(state, chunk);
        state = step.state;
        for (const event of step.events) request.onEvent?.(event);
      }
      // The SDK ends the iteration quietly when the request is aborted mid-stream.
      if (request.signal?.aborted) throw errors.stopped();
      this.assertFinished(state.finishReason);
      if (request.previousResponseId !== null) this.conversations.delete(request.previousResponseId);
      return {
        responseId: this.remember([...messages, assistantMessage(state)]),
        text: state.text,
        functionCalls: functionCalls(state),
        refusal: state.refusal === '' ? null : state.refusal,
        usage: toTokenUsage(state.usage),
      };
    } catch (error) {
      throw request.signal?.aborted ? errors.stopped() : mapOpenAiError(error, this.options.vendor);
    }
  }

  async generateObject<T>(request: ObjectRequest<T>): Promise<{ value: T; usage: TokenUsage }> {
    try {
      const input = typeof request.input === 'string' ? [{ role: 'user' as const, content: request.input }] : toChatMessages(request.input);
      const response = await this.client.chat.completions.create(
        {
          model: request.model,
          messages: [{ role: 'system', content: request.instructions }, ...input],
          response_format: zodResponseFormat(request.schema, request.schemaName),
          ...this.reasoning(request.reasoningEffort ?? null),
        },
        { signal: request.signal },
      );
      const choice = response.choices[0];
      if (!choice) throw errors.modelError('the reply was empty.');
      if (choice.message.refusal) throw errors.modelRefusal(choice.message.refusal);
      this.assertFinished(choice.finish_reason);
      return { value: parseObject(request.schema, choice.message.content ?? ''), usage: toTokenUsage(response.usage) };
    } catch (error) {
      throw request.signal?.aborted ? errors.stopped() : mapOpenAiError(error, this.options.vendor);
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const ids: string[] = [];
      for await (const model of this.client.models.list({ timeout: LIST_MODELS_TIMEOUT_MS, maxRetries: 0 })) {
        // Gemini names its models "models/gemini-…"; requests take the bare id.
        ids.push(model.id.replace(/^models\//, ''));
      }
      return ids;
    } catch (error) {
      throw mapOpenAiError(error, this.options.vendor);
    }
  }

  /** Request body for one streamed turn. The instructions go first every time; the kept conversation leaves them out. */
  private turnParams(request: ModelTurnRequest, messages: ChatCompletionMessageParam[]): ChatCompletionCreateParamsStreaming {
    return {
      model: request.model,
      messages: [{ role: 'system', content: request.instructions }, ...messages],
      ...(request.tools.length > 0
        ? { tools: request.tools.map(toChatTool), tool_choice: toChatToolChoice(request.toolChoice) }
        : {}),
      ...this.reasoning(request.reasoningEffort),
      stream: true,
      stream_options: { include_usage: true },
    };
  }

  private reasoning(effort: ReasoningEffort | null): { reasoning_effort?: ReturnType<typeof toChatEffort> } {
    return effort !== null && this.options.sendsReasoning ? { reasoning_effort: toChatEffort(effort) } : {};
  }

  private history(responseId: string | null): ChatCompletionMessageParam[] {
    if (responseId === null) return [];
    const messages = this.conversations.get(responseId);
    if (!messages) throw errors.modelError('the conversation it continues is no longer kept.');
    return messages;
  }

  /** Keeps the conversation under a new response id, dropping the oldest beyond the limit. */
  private remember(messages: ChatCompletionMessageParam[]): string {
    const id = `chat_${randomUUID()}`;
    this.conversations.set(id, messages);
    for (const oldest of this.conversations.keys()) {
      if (this.conversations.size <= MAX_CONVERSATIONS) break;
      this.conversations.delete(oldest);
    }
    return id;
  }

  private assertFinished(finishReason: ChatStreamState['finishReason']): void {
    if (finishReason === 'length') throw errors.modelError('the reply reached the output token limit before it finished.');
    if (finishReason === 'content_filter') throw errors.modelError(`${this.options.vendor.name}'s content filter stopped the reply.`);
  }
}

export function toTokenUsage(usage: CompletionUsage | null | undefined): TokenUsage {
  return {
    inputTokens: usage?.prompt_tokens ?? 0,
    cachedInputTokens: usage?.prompt_tokens_details?.cached_tokens ?? 0,
    outputTokens: usage?.completion_tokens ?? 0,
    reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens ?? 0,
  };
}
