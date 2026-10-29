import type { ModelProvider } from '@atlas/shared';
import type { CatalogModel } from '../../application/models/pickLineup';
import type { ModelClient, ModelTurnRequest, ModelTurnResult, ObjectRequest } from '../../application/ports/ModelClient';
import type { TokenUsage } from '../../domain/pricing';

/**
 * One ModelClient over every provider that is set up: each call goes to the provider whose catalog holds the
 * requested model, and a model no catalog names goes to the default provider. A turn continues on the provider
 * that made its response, since every question keeps one model.
 */
export class ModelRouter implements ModelClient {
  private readonly clients: ReadonlyMap<ModelProvider, ModelClient>;
  private readonly providerOf: ReadonlyMap<string, ModelProvider>;
  private readonly defaultClient: ModelClient;

  constructor(clients: ReadonlyMap<ModelProvider, ModelClient>, models: CatalogModel[], defaultProvider: ModelProvider) {
    const fallback = clients.get(defaultProvider);
    if (!fallback) throw new Error(`The default provider ${defaultProvider} has no client.`);
    this.clients = clients;
    this.providerOf = new Map(models.map((model) => [model.id, model.provider]));
    this.defaultClient = fallback;
  }

  turn(request: ModelTurnRequest): Promise<ModelTurnResult> {
    return this.clientFor(request.model).turn(request);
  }

  generateObject<T>(request: ObjectRequest<T>): Promise<{ value: T; usage: TokenUsage }> {
    return this.clientFor(request.model).generateObject(request);
  }

  /** Every provider's models; a provider that cannot list them adds none. */
  async listModels(): Promise<string[]> {
    const lists = await Promise.allSettled([...this.clients.values()].map((client) => client.listModels()));
    return lists.flatMap((list) => (list.status === 'fulfilled' ? list.value : []));
  }

  private clientFor(model: string): ModelClient {
    const provider = this.providerOf.get(model);
    return (provider === undefined ? undefined : this.clients.get(provider)) ?? this.defaultClient;
  }
}
