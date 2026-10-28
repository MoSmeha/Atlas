import { routes } from '@atlas/shared';
import { modelsResponse } from '../data/models';
import { sendError, sendJson } from '../http';
import { type Route, route } from '../router';
import { state } from '../state';

/** Health, the model lineup and per-session usage. */
export const metaRoutes: Route[] = [
  route('GET', routes.health, ({ res }) => {
    sendJson(res, 200, { ok: true, version: '0.1.0-mock', apiKeyPresent: state.apiKeyPresent });
  }),
  route('GET', routes.models, ({ res }) => sendJson(res, 200, modelsResponse)),
  route('GET', routes.usage, ({ res, url }) => {
    const sessionId = url.searchParams.get('sessionId');
    if (!sessionId) return sendError(res, 'invalid_request', 'Add ?sessionId= to ask for usage.');
    sendJson(res, 200, state.sessions.usage(sessionId));
  }),
];
