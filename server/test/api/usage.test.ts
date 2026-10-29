import { type Answer, type Usage, UsageResponse } from '@atlas/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/app';
import { SessionStore } from '../../src/application/session/SessionStore';
import { makeApiDeps } from '../fakes/apiDeps';

const answer: Answer = {
  kind: 'not_found',
  language: 'en',
  markdown: 'Not in the loaded documents.',
  table: null,
  sources: [],
  unreadableFiles: [],
  warnings: [],
};

function usage(costUsd: number): Usage {
  return { model: 'small-model', inputTokens: 900, cachedInputTokens: 100, outputTokens: 50, reasoningTokens: 0, costUsd, durationMs: 1200 };
}

const sessions = new SessionStore();
const session = sessions.get('s1');
session.addTurn({ question: 'Is the fee stated?', answer, resultIds: [] }, usage(0.002));
session.addTurn({ question: 'And the retention?', answer, resultIds: [] }, usage(0.003));
const called = sessions.get('called');
called.addTurn({ question: 'What is the fee?', answer, resultIds: [] }, usage(0.002));
called.recordCall('live_1', 90, 0.05);
called.addSpend(0.001);

const app = buildApp(makeApiDeps({ usage: { sessions } }));
afterAll(() => app.close());

const getUsage = (query: string) => app.inject({ method: 'GET', url: `/api/usage${query}` });

describe('GET /api/usage', () => {
  it("reports the last answer's usage and the chat's question count and total cost", async () => {
    const response = await getUsage('?sessionId=s1');
    expect(response.statusCode).toBe(200);
    const body = UsageResponse.parse(response.json());
    expect(body.last).toEqual(usage(0.003));
    expect(body.session.questions).toBe(2);
    expect(body.session.costUsd).toBeCloseTo(0.005, 12);
    expect(body.session.voiceSeconds).toBe(0);
  });

  it("adds the chat's voice calls and dictation to its cost, and reports how long the calls were", async () => {
    const body = UsageResponse.parse((await getUsage('?sessionId=called')).json());
    expect(body.session.questions).toBe(1);
    expect(body.session.voiceSeconds).toBe(90);
    expect(body.session.costUsd).toBeCloseTo(0.002 + 0.075 + 0.001, 12);
  });

  it('reports nothing spent for a chat that has not asked anything, without starting it', async () => {
    const response = await getUsage('?sessionId=fresh');
    expect(response.json()).toEqual({ last: null, session: { questions: 0, costUsd: 0, voiceSeconds: 0 } });
    expect(sessions.find('fresh')).toBeNull();
  });

  it('asks for the session id when it is missing', async () => {
    const response = await getUsage('');
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatchObject({ code: 'invalid_request', message: expect.stringContaining('sessionId') });
  });
});
