import { addUsage, costUsd, zeroUsage, type TokenPrice, type TokenUsage } from '../../domain/pricing';
import type { ModelClient, ModelTurnRequest, ModelTurnResult, ObjectRequest } from '../ports/ModelClient';

/**
 * A ModelClient that passes every call on and adds up the tokens each model used, so the cost of a question
 * includes the calls its tools make, such as extract_schedule asking the small model. Use one per question.
 */
export class UsageMeter implements ModelClient {
  private readonly inner: ModelClient;
  private readonly byModel = new Map<string, TokenUsage>();
  private turnCount = 0;

  constructor(inner: ModelClient) {
    this.inner = inner;
  }

  async turn(request: ModelTurnRequest): Promise<ModelTurnResult> {
    this.turnCount += 1;
    const result = await this.inner.turn(request);
    this.add(request.model, result.usage);
    return result;
  }

  async generateObject<T>(request: ObjectRequest<T>): Promise<{ value: T; usage: TokenUsage }> {
    const result = await this.inner.generateObject(request);
    this.add(request.model, result.usage);
    return result;
  }

  listModels(): Promise<string[]> {
    return this.inner.listModels();
  }

  /** Model turns started so far, the tools' own included. */
  get turns(): number {
    return this.turnCount;
  }

  /** Tokens of every finished call so far, all models together. */
  get usage(): TokenUsage {
    return [...this.byModel.values()].reduce((total, usage) => addUsage(total, usage), zeroUsage);
  }

  /** Dollars spent so far, each model's tokens at its own price. A model with no price counts as free. */
  costUsd(priceOf: (model: string) => TokenPrice | null): number {
    let dollars = 0;
    for (const [model, usage] of this.byModel) {
      const price = priceOf(model);
      if (price !== null) dollars += costUsd(usage, price);
    }
    return dollars;
  }

  private add(model: string, usage: TokenUsage): void {
    this.byModel.set(model, addUsage(this.byModel.get(model) ?? zeroUsage, usage));
  }
}
