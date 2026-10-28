import { z } from 'zod';
import { type ChatEvent, ChatRequest, routes } from '@atlas/shared';
import type { AskQuestion } from '../../application/AskQuestion';
import { errors } from '../../application/errors';
import type { SessionStore } from '../../application/session/SessionStore';
import type { Workspace } from '../../application/workspace/Workspace';
import { chatEventSink } from '../chatEvents';
import { openSse } from '../sse';
import type { RoutePlugin } from '../zod';

export interface ChatDeps {
  askQuestion: AskQuestion;
  sessions: SessionStore;
  workspace: Workspace;
  /** False while OPENAI_API_KEY is unset; questions are then refused before a stream opens. */
  apiKeyPresent: boolean;
}

const SessionParams = z.object({ sessionId: z.string().min(1) });

export const chatRoutes: RoutePlugin<{ deps: ChatDeps }> = async (app, { deps }) => {
  app.post(routes.chat, { schema: { body: ChatRequest } }, async (request, reply) => {
    // Checked before the stream opens, so these come back as a JSON error with a status code.
    if (!deps.apiKeyPresent) throw errors.missingApiKey();
    deps.workspace.require();

    const channel = openSse<ChatEvent>(reply);
    const events = chatEventSink(channel, (error) => request.log.error(error));
    try {
      await deps.askQuestion.execute({ ...request.body, signal: events.signal, onEvent: (event) => events.send(event) });
    } catch (error) {
      events.fail(error);
    } finally {
      channel.close();
    }
  });

  app.delete(`${routes.chat}/:sessionId`, { schema: { params: SessionParams } }, async (request, reply) => {
    deps.sessions.clear(request.params.sessionId);
    return reply.status(204).send();
  });
};
