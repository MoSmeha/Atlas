import { randomUUID } from 'node:crypto';
import type { Answer, ChatEvent, ErrorDetail, ModelTier, Usage } from '@atlas/shared';
import { isArabic } from '../domain/language';
import { zeroUsage, type TokenPrice } from '../domain/pricing';
import { speechFor } from '../domain/speech';
import { conversationInput } from './agent/conversationInput';
import { buildInstructions } from './agent/instructions';
import { noteEvidence } from './agent/noteEvidence';
import { runAgent, type AgentRun } from './agent/runAgent';
import { UsageMeter } from './agent/UsageMeter';
import { AppError, errors } from './errors';
import { checkAnswer } from './guards/checkAnswer';
import { checkLanguage } from './guards/languageGuard';
import { unreadableFiles } from './guards/sourcesGuard';
import { ToolOutputLog } from './guards/ToolOutputLog';
import { chooseModel } from './models/chooseModel';
import type { CatalogModel, Lineup } from './models/pickLineup';
import type { Clock } from './ports/Clock';
import type { EmbeddingClient } from './ports/EmbeddingClient';
import type { ModelClient, ReasoningEffort } from './ports/ModelClient';
import type { PageRenderer } from './ports/PageRenderer';
import type { ResultExporter } from './ports/ResultExporter';
import type { RunLogger } from './ports/RunLogger';
import type { Session } from './session/Session';
import type { SessionStore } from './session/SessionStore';
import { tools as registeredTools } from './tools/registry';
import { submitAnswer } from './tools/submitAnswer';
import type { Tool, ToolContext } from './tools/Tool';
import type { Workspace } from './workspace/Workspace';

const INTERNAL_MESSAGE = 'Something went wrong while answering. Details are in the server log.';

export interface AskQuestionDeps {
  workspace: Workspace;
  sessions: SessionStore;
  /** Null while no model provider is set up; questions then fail with missing_api_key. */
  modelClient: ModelClient | null;
  embeddings: EmbeddingClient | null;
  renderer: PageRenderer;
  exporter: ResultExporter;
  clock: Clock;
  logger: RunLogger;
  /** The three models a question may use; their catalog prices give the cost. */
  lineup: Lineup;
  /** Tier of the default answer model (`answerTier` of the model config). */
  answerTier: ModelTier;
  reasoningEffort: ReasoningEffort | null;
  maxRounds: number;
  exportsDir: string;
  /** Tools the model may call; the registry's when left out. */
  tools?: readonly Tool[];
}

export interface AskQuestionInput {
  sessionId: string;
  question: string;
  /** Requested model ID; anything but one of the lineup's three gets the default answer model. */
  model?: string | null;
  /** Spoken in a voice call: the instructions allow for transcription mistakes, and a `speech` event precedes the answer. */
  spoken?: boolean;
  /** Stops the question, for example when the browser disconnects. */
  signal?: AbortSignal;
  /** Receives started, the trace steps, the streamed answer, then speech when spoken, and then answer or error. */
  onEvent: (event: ChatEvent) => void;
}

export type AskOutcome = { ok: true; answer: Answer; usage: Usage } | { ok: false; error: ErrorDetail };

interface Question {
  id: string;
  model: CatalogModel;
  session: Session;
  meter: UsageMeter | null;
}

/**
 * Answers one question in a chat: runs the tool loop with the chat's recent turns, checks the answer, and keeps
 * the turn so follow-ups can build on it. Every outcome ends in an `answer` or an `error` event and a log entry.
 */
export class AskQuestion {
  private readonly deps: AskQuestionDeps;

  constructor(deps: AskQuestionDeps) {
    this.deps = deps;
  }

  async execute(input: AskQuestionInput): Promise<AskOutcome> {
    const startedAt = this.deps.clock.now().getTime();
    const question: Question = {
      id: randomUUID(),
      model: chooseModel(this.deps.lineup, this.deps.answerTier, input.model),
      session: this.deps.sessions.get(input.sessionId),
      meter: this.deps.modelClient === null ? null : new UsageMeter(this.deps.modelClient),
    };

    const earlierResults = question.session.resultIds().length;
    let run: AgentRun<Answer>;
    try {
      run = await this.run(question, input);
    } catch (error) {
      const usage = this.usage(question, startedAt);
      const detail = toErrorDetail(error);
      this.log(question, input, usage, { rounds: question.meter?.turns ?? 0, answerKind: null, error: logText(error) });
      input.onEvent({ type: 'error', error: detail });
      return { ok: false, error: detail };
    }

    const usage = this.usage(question, startedAt);
    const resultIds = question.session.resultIds().slice(earlierResults);
    question.session.addTurn({ question: input.question, answer: run.value, resultIds }, usage);
    this.log(question, input, usage, { rounds: run.rounds, answerKind: run.value.kind, error: null });
    if (input.spoken === true) input.onEvent({ type: 'speech', text: speechFor(run.value) });
    input.onEvent({ type: 'answer', answer: run.value, usage });
    return { ok: true, answer: run.value, usage };
  }

  private async run(question: Question, input: AskQuestionInput): Promise<AgentRun<Answer>> {
    const { deps } = this;
    if (question.meter === null || deps.embeddings === null) throw errors.missingApiKey();
    const { folder, index } = deps.workspace.require();
    const { session, model } = question;
    const tools = deps.tools ?? registeredTools;
    const outputs = new ToolOutputLog();
    const context: ToolContext = {
      folder,
      index,
      embeddings: deps.embeddings,
      model: question.meter,
      renderer: deps.renderer,
      exporter: deps.exporter,
      session,
      clock: deps.clock,
      models: { answer: model.id, small: deps.lineup.small.id },
      exportsDir: deps.exportsDir,
      signal: input.signal ?? new AbortController().signal,
    };
    const instructions = buildInstructions({
      documents: index.documents(),
      today: deps.clock.now(),
      unreadable: unreadableFiles(index),
      tools: [...tools.map((tool) => tool.name), submitAnswer.name],
      spoken: input.spoken === true,
    });
    const firstInput = conversationInput(session, input.question);
    session.evidence.noteText(input.question);
    input.onEvent({ type: 'started', questionId: question.id, model: model.id });

    return runAgent<Answer>({
      questionId: question.id,
      model: model.id,
      instructions,
      input: firstInput,
      tools: outputs.watch(noteEvidence(tools)),
      submitTool: submitAnswer,
      context,
      maxRounds: deps.maxRounds,
      reasoningEffort: deps.reasoningEffort,
      logger: deps.logger,
      onEvent: input.onEvent,
      onSubmit: checkLanguage(
        isArabic(input.question) ? 'ar' : 'en',
        checkAnswer({
          question: input.question,
          index,
          session,
          toolOutputs: () => outputs.outputs,
          toolCalls: () => outputs.calls,
        }),
      ),
    });
  }

  /** Tokens of every model call the question made, the tools' own included, each priced at its model's rate. */
  private usage(question: Question, startedAt: number): Usage {
    const { meter } = question;
    return {
      model: question.model.id,
      ...(meter?.usage ?? zeroUsage),
      costUsd: meter?.costUsd((id) => this.priceOf(id)) ?? 0,
      durationMs: Math.max(0, Math.round(this.deps.clock.now().getTime() - startedAt)),
    };
  }

  private priceOf(modelId: string): TokenPrice | null {
    return Object.values(this.deps.lineup).find((model) => model.id === modelId) ?? null;
  }

  private log(
    question: Question,
    input: AskQuestionInput,
    usage: Usage,
    result: { rounds: number; answerKind: string | null; error: string | null },
  ): void {
    const { model, costUsd, durationMs, ...tokens } = usage;
    this.deps.logger.question({
      questionId: question.id,
      sessionId: input.sessionId,
      question: input.question,
      model,
      rounds: result.rounds,
      usage: tokens,
      costUsd,
      durationMs,
      answerKind: result.answerKind,
      error: result.error,
    });
  }
}

function toErrorDetail(error: unknown): ErrorDetail {
  if (error instanceof AppError) return { code: error.code, message: error.message, retryAfterSeconds: error.retryAfterSeconds };
  return { code: 'internal', message: INTERNAL_MESSAGE };
}

/** What the log keeps about a failure: the code and message, or the stack of an unexpected error. */
function logText(error: unknown): string {
  if (error instanceof AppError) return `${error.code}: ${error.message}`;
  if (error instanceof Error) return error.stack ?? `${error.name}: ${error.message}`;
  return String(error);
}
