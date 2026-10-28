import { ChatEvent, UsageResponse } from '@atlas/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { type AtlasApp, buildApp } from '../../src/api/app';
import type { ModelTurnResult } from '../../src/application/ports/ModelClient';
import { SessionStore } from '../../src/application/session/SessionStore';
import type { SubmittedAnswer } from '../../src/application/tools/submitAnswer';
import { defineTool, type Tool } from '../../src/application/tools/Tool';
import { Workspace } from '../../src/application/workspace/Workspace';
import { makeApiDeps, makeAskQuestion } from '../fakes/apiDeps';
import { FakeIndex } from '../fakes/FakeIndex';
import { callsTools, FakeModelClient } from '../fakes/FakeModelClient';
import { MemoryRunLogger } from '../fakes/MemoryRunLogger';
import { boqTable, excelRecord } from '../fakes/records';

const itemsSql = 'SELECT item_code, amount, _row FROM boq_1 WHERE _is_total = 0 AND amount > 1000000';
const queryItems = callsTools({ name: 'query_tables', args: { sql: itemsSql, title: 'Items over 1,000,000' } });
const question = { sessionId: 's1', question: 'Which items cost over 1,000,000?' };

function submits(args: Partial<SubmittedAnswer>): Partial<ModelTurnResult> {
  const full: SubmittedAnswer = { kind: 'answer', language: 'en', markdown: '', result_id: null, sources: [], ...args };
  return { functionCalls: [{ callId: 'call_submit', name: 'submit_answer', arguments: JSON.stringify(full) }] };
}

const answersA1 = submits({ markdown: 'One item costs over 1,000,000: A1 at SAR 2,000,000.', result_id: 'r1' });

let apps: AtlasApp[] = [];
afterEach(async () => {
  await Promise.all(apps.map((app) => app.close()));
  apps = [];
});

function setup(
  script: ConstructorParameters<typeof FakeModelClient>[0],
  options: { indexed?: boolean; apiKeyPresent?: boolean; tools?: readonly Tool[] } = {},
) {
  const index = new FakeIndex();
  index.save(excelRecord('BOQ.xlsx', [boqTable([['A1', 'Piles', 10, 200000, 2000000], ['A2', 'Concrete', 5, 100, 500]])]));
  index.onQuery = () => ({ columns: ['item_code', 'amount', '_row'], rows: [['A1', 2000000, 5]], truncated: false });
  const workspace = new Workspace();
  if (options.indexed !== false) workspace.activate('/folder', index);
  const sessions = new SessionStore();
  const model = new FakeModelClient(script);
  const logger = new MemoryRunLogger();
  const askQuestion = makeAskQuestion({ workspace, sessions, modelClient: model, logger, ...(options.tools ? { tools: options.tools } : {}) });
  const app = buildApp(
    makeApiDeps({ chat: { askQuestion, sessions, workspace, apiKeyPresent: options.apiKeyPresent ?? true }, usage: { sessions } }),
  );
  apps.push(app);
  return { app, model, logger, sessions };
}

/** The events of an SSE body, each checked against the shared schema. */
function sseEvents(body: string): ChatEvent[] {
  return body
    .split('\n\n')
    .filter((block) => block.startsWith('data: '))
    .map((block) => ChatEvent.parse(JSON.parse(block.slice('data: '.length))));
}

const postChat = (app: AtlasApp, payload: object) => app.inject({ method: 'POST', url: '/api/chat', payload });

describe('POST /api/chat', () => {
  it('streams started, the trace steps, the answer text and the answer, in order', async () => {
    const { app } = setup([queryItems, answersA1]);

    const response = await postChat(app, question);

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    const events = sseEvents(response.body);
    expect(events.map((event) => event.type)).toEqual(['started', 'step', 'step', 'answer_delta', 'answer']);
    expect(events[0]).toEqual({ type: 'started', questionId: expect.any(String), model: 'frontier-model' });
    expect(events[1]).toMatchObject({ type: 'step', step: { name: 'query_tables', status: 'running' } });
    expect(events[2]).toMatchObject({ type: 'step', step: { name: 'query_tables', status: 'ok' } });
    expect(events[4]).toMatchObject({
      type: 'answer',
      answer: { kind: 'answer', markdown: 'One item costs over 1,000,000: A1 at SAR 2,000,000.', table: { resultId: 'r1' } },
      usage: { model: 'frontier-model' },
    });
  });

  it('uses the model the request names, and counts the answer in the chat usage', async () => {
    const { app } = setup([submits({ kind: 'out_of_scope', markdown: 'I only answer about the loaded documents.' })]);

    const events = sseEvents((await postChat(app, { ...question, question: 'Hello', model: 'small-model' })).body);

    expect(events[0]).toMatchObject({ type: 'started', model: 'small-model' });
    const usage = UsageResponse.parse((await app.inject({ method: 'GET', url: '/api/usage?sessionId=s1' })).json());
    expect(usage).toMatchObject({ last: { model: 'small-model' }, session: { questions: 1 } });
  });

  it('ends the stream with an error event when the question fails after it started', async () => {
    const { app } = setup([]);
    const events = sseEvents((await postChat(app, question)).body);
    expect(events.map((event) => event.type)).toEqual(['started', 'error']);
    expect(events[1]).toMatchObject({ type: 'error', error: { code: 'internal' } });
  });

  it('answers 409 not_indexed as JSON, without a stream, when no folder is loaded', async () => {
    const { app, model } = setup([answersA1], { indexed: false });
    const response = await postChat(app, question);
    expect(response.statusCode).toBe(409);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.json()).toEqual({ error: { code: 'not_indexed', message: 'Load a folder before asking a question.', retryAfterSeconds: null } });
    expect(model.requests).toHaveLength(0);
  });

  it('answers 503 missing_api_key as JSON when the key is not set', async () => {
    const { app, model } = setup([answersA1], { apiKeyPresent: false });
    const response = await postChat(app, question);
    expect(response.statusCode).toBe(503);
    expect(response.json().error).toMatchObject({ code: 'missing_api_key', message: expect.stringContaining('OPENAI_API_KEY') });
    expect(model.requests).toHaveLength(0);
  });

  it('refuses an empty question', async () => {
    const { app } = setup([]);
    const response = await postChat(app, { sessionId: 's1', question: '   ' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('invalid_request');
  });

  it('stops the question when the browser closes the stream', async () => {
    let toolStarted = () => {};
    const started = new Promise<void>((resolve) => {
      toolStarted = resolve;
    });
    const waitForStop = defineTool({
      name: 'wait_for_stop',
      description: 'Waits until the question is stopped.',
      parameters: z.object({}),
      async run(_args, context) {
        toolStarted();
        await new Promise((resolve) => context.signal.addEventListener('abort', resolve, { once: true }));
        return { output: {}, summary: 'Stopped' };
      },
    });
    const { app, model, logger } = setup([callsTools({ name: 'wait_for_stop', args: {} }), answersA1], { tools: [waitForStop] });
    const address = await app.listen({ port: 0, host: '127.0.0.1' });

    const browser = new AbortController();
    const response = await fetch(`${address}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(question),
      signal: browser.signal,
    });
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    await started;
    browser.abort();

    await vi.waitFor(() => expect(logger.questions).toHaveLength(1));
    expect(logger.questions[0]).toMatchObject({ answerKind: null, error: expect.stringContaining('stopped') });
    expect(model.requests).toHaveLength(1);
  });
});

describe('DELETE /api/chat/:sessionId', () => {
  it('forgets the chat: its turns and spend', async () => {
    const { app, sessions } = setup([queryItems, answersA1]);
    await postChat(app, question);
    expect(sessions.find('s1')?.turns).toHaveLength(1);

    const response = await app.inject({ method: 'DELETE', url: '/api/chat/s1' });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(sessions.find('s1')).toBeNull();
    const usage = (await app.inject({ method: 'GET', url: '/api/usage?sessionId=s1' })).json();
    expect(usage).toEqual({ last: null, session: { questions: 0, costUsd: 0 } });
  });
});
