import type {
  FunctionCall,
  ModelClient,
  ModelTurnRequest,
  ModelTurnResult,
  ObjectRequest,
} from '../../src/application/ports/ModelClient';
import type { TokenUsage } from '../../src/domain/pricing';

export const fakeUsage: TokenUsage = { inputTokens: 100, cachedInputTokens: 0, outputTokens: 20, reasoningTokens: 5 };

/** Builds a scripted model turn that calls the given tools. */
export function callsTools(...calls: { name: string; args: unknown }[]): Partial<ModelTurnResult> {
  return {
    functionCalls: calls.map(
      (call, i): FunctionCall => ({ callId: `call_${call.name}_${i}`, name: call.name, arguments: JSON.stringify(call.args) }),
    ),
  };
}

/**
 * A ModelClient that replays scripted turns in order and records every request.
 * A script entry may be a function of the request, for replies that depend on earlier tool outputs.
 */
export class FakeModelClient implements ModelClient {
  readonly requests: ModelTurnRequest[] = [];
  readonly objectRequests: ObjectRequest<unknown>[] = [];
  objects: unknown[] = [];
  models: string[] = ['frontier-model', 'balanced-model', 'small-model'];
  private readonly script: (Partial<ModelTurnResult> | ((request: ModelTurnRequest) => Partial<ModelTurnResult>))[];

  constructor(script: (Partial<ModelTurnResult> | ((request: ModelTurnRequest) => Partial<ModelTurnResult>))[] = []) {
    this.script = script;
  }

  async turn(request: ModelTurnRequest): Promise<ModelTurnResult> {
    this.requests.push(request);
    const step = this.script[this.requests.length - 1];
    if (step === undefined) throw new Error(`FakeModelClient has no scripted turn ${this.requests.length}`);
    const result = typeof step === 'function' ? step(request) : step;
    if (result.text) request.onEvent?.({ type: 'text_delta', delta: result.text });
    for (const call of result.functionCalls ?? []) {
      request.onEvent?.({ type: 'tool_call_started', callId: call.callId, name: call.name });
      request.onEvent?.({ type: 'tool_arguments_delta', callId: call.callId, name: call.name, delta: call.arguments });
    }
    return {
      responseId: `resp_${this.requests.length}`,
      text: '',
      functionCalls: [],
      refusal: null,
      usage: fakeUsage,
      ...result,
    };
  }

  async generateObject<T>(request: ObjectRequest<T>): Promise<{ value: T; usage: TokenUsage }> {
    this.objectRequests.push(request as ObjectRequest<unknown>);
    if (this.objects.length === 0) throw new Error('FakeModelClient has no scripted object');
    return { value: request.schema.parse(this.objects.shift()), usage: fakeUsage };
  }

  async listModels(): Promise<string[]> {
    return this.models;
  }
}
