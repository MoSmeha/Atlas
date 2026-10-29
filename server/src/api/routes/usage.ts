import { z } from 'zod';
import { routes, UsageResponse } from '@atlas/shared';
import type { SessionStore } from '../../application/session/SessionStore';
import type { RoutePlugin } from '../zod';

export interface UsageDeps {
  sessions: SessionStore;
}

const UsageQuery = z.object({ sessionId: z.string().min(1, 'Add ?sessionId= to ask for usage.') });

export const usageRoutes: RoutePlugin<{ deps: UsageDeps }> = async (app, { deps }) => {
  app.get(routes.usage, { schema: { querystring: UsageQuery, response: { 200: UsageResponse } } }, async (request) => {
    const session = deps.sessions.find(request.query.sessionId);
    return {
      last: session?.lastUsage ?? null,
      session: {
        questions: session?.turns.length ?? 0,
        costUsd: session?.totalCostUsd ?? 0,
        voiceSeconds: session?.voiceSeconds ?? 0,
      },
    };
  });
};
