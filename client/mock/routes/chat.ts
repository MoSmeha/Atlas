import { type ChatEvent, ChatRequest, type ResultTable, type ToolStep, routes } from '@atlas/shared';
import { findModel, modelsResponse, speedOf, usageFor } from '../data/models';
import { pickScript } from '../data/pickScript';
import type { Script, ScriptStep } from '../data/script';
import { type SseChannel, delay, openSse, readJson, sendError } from '../http';
import { PARAM, type Route, route } from '../router';
import { state } from '../state';

/** Rows an answer carries, as the real server caps them; the saved result keeps every row for export. */
const MAX_TABLE_ROWS = 200;

let questionCount = 0;

/** Asking a question, streamed like the real agent, and clearing a chat. */
export const chatRoutes: Route[] = [
  route('POST', routes.chat, async ({ req, res }) => {
    const parsed = ChatRequest.safeParse(await readJson(req));
    if (!parsed.success) return sendError(res, 'invalid_request', 'Type a question of up to 4,000 characters.');
    const request = parsed.data;
    if (!state.apiKeyPresent) {
      return sendError(res, 'missing_api_key', 'OPENAI_API_KEY is not set. Add it to the .env file and restart Atlas.');
    }
    const status = state.workspace.status();
    if (status.folder === null) return sendError(res, 'not_indexed', 'Load a folder before asking a question.');
    const model = findModel(request.model ?? modelsResponse.defaultModel);
    if (!model) return sendError(res, 'invalid_request', `There is no model called ${request.model}.`);

    const script = pickScript({ question: request.question, documents: status.documents });
    const channel = openSse<ChatEvent>(res);
    const started = Date.now();
    const pace = speedOf(model);
    channel.send({ type: 'started', questionId: `q${++questionCount}`, model: model.id });

    if (!(await playSteps(script.steps, channel, pace))) return;
    if (script.outcome.type === 'error') {
      channel.send({ type: 'error', error: script.outcome.error });
      return channel.close();
    }
    if (script.draft !== null) {
      if (!(await stream(script.draft, channel, script.chunkMs * pace))) return;
      await delay(400 * pace);
      channel.send({ type: 'answer_reset' });
    }
    const { answer, table } = script.outcome;
    if (!(await stream(answer.markdown, channel, script.chunkMs * pace))) return;

    const saved: ResultTable | null = table ? { ...table, resultId: state.sessions.nextResultId(request.sessionId) } : null;
    if (saved) state.sessions.saveResult(request.sessionId, saved);
    const shown = saved ? { ...saved, rows: saved.rows.slice(0, MAX_TABLE_ROWS) } : null;
    const usage = usageFor(model, scaled(script.tokens, model.tier === 'small'), Date.now() - started);
    state.sessions.record(request.sessionId, usage);
    channel.send({ type: 'answer', answer: { ...answer, table: shown }, usage });
    channel.close();
  }),

  route('DELETE', routes.chatSession(PARAM), ({ res, params: [sessionId = ''] }) => {
    state.sessions.clear(sessionId);
    res.writeHead(204).end();
  }),
];

/** Sends each step as running, then finished. False when the browser went away (Stop). */
async function playSteps(steps: ScriptStep[], channel: SseChannel<ChatEvent>, pace: number): Promise<boolean> {
  for (const [i, scripted] of steps.entries()) {
    const step: ToolStep = {
      id: `step-${i + 1}`,
      name: scripted.name,
      inputSummary: scripted.inputSummary,
      status: 'running',
      durationMs: null,
      resultSummary: null,
      error: null,
    };
    channel.send({ type: 'step', step });
    await delay(300 * pace + scripted.durationMs);
    if (channel.closed) return false;
    const done: ToolStep = scripted.failure
      ? { ...step, status: scripted.failure.status, durationMs: scripted.durationMs, error: scripted.failure.error }
      : { ...step, status: 'ok', durationMs: scripted.durationMs, resultSummary: scripted.resultSummary };
    channel.send({ type: 'step', step: done });
  }
  return true;
}

/** Streams text a few words at a time. False when the browser went away. */
async function stream(text: string, channel: SseChannel<ChatEvent>, chunkMs: number): Promise<boolean> {
  const words = text.match(/\S+\s*/g) ?? [];
  for (let i = 0; i < words.length; i += 3) {
    if (channel.closed) return false;
    channel.send({ type: 'answer_delta', delta: words.slice(i, i + 3).join('') });
    await delay(chunkMs);
  }
  return !channel.closed;
}

/** The small model reads the same context but writes a little less. */
function scaled(tokens: Script['tokens'], small: boolean): Script['tokens'] {
  return small ? { ...tokens, output: Math.round(tokens.output * 0.8), reasoning: 0 } : tokens;
}
