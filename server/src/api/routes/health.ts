import { HealthResponse, routes } from '@atlas/shared';
import type { RoutePlugin } from '../zod';

export interface HealthDeps {
  version: string;
  apiKeyPresent: boolean;
}

export const healthRoutes: RoutePlugin<{ deps: HealthDeps }> = async (app, { deps }) => {
  app.get(routes.health, { schema: { response: { 200: HealthResponse } } }, async () => ({
    ok: true as const,
    version: deps.version,
    apiKeyPresent: deps.apiKeyPresent,
  }));
};
