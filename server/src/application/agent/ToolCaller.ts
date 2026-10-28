import type { ToolStep } from '@atlas/shared';
import { AppError, errors } from '../errors';
import type { FunctionCall } from '../ports/ModelClient';
import type { RunLogger } from '../ports/RunLogger';
import { ToolError, type Tool, type ToolContext } from '../tools/Tool';
import { agentMessages } from './agentMessages';
import { callKey } from './callKey';
import type { AgentEvent } from './events';
import { parseArguments } from './parseArguments';
import { inputSummary } from './summaries';
import { capOutput, toJsonText } from './toolOutput';

export interface ToolCallerOptions {
  questionId: string;
  tools: Tool[];
  /** Name of the answer tool, offered with the others when the model calls a tool that does not exist. */
  submitTool: string;
  context: ToolContext;
  logger: RunLogger;
  onEvent: (event: AgentEvent) => void;
}

interface Started {
  call: FunctionCall;
  summary: string;
  /** Index of the call's step in the trace. */
  step: number;
}

/** A call ready to run, or one already answered because its arguments were wrong or it was a repeat. */
type Job =
  | (Started & { kind: 'run'; tool: Tool; args: Record<string, unknown> })
  | (Started & { kind: 'answered'; status: 'error' | 'refused'; output: string; message: string; stepError: string });

const REPEAT_STEP_ERROR = 'Skipped: the same request as an earlier step.';

/**
 * Runs the model's tool calls for one question. It checks the arguments, refuses a call that repeats an
 * earlier one, times and logs every run, and reports each call as a trace step when it starts and ends.
 */
export class ToolCaller {
  private readonly options: ToolCallerOptions;
  private readonly tools: Map<string, Tool>;
  private readonly called = new Set<string>();
  private readonly steps: ToolStep[] = [];

  constructor(options: ToolCallerOptions) {
    this.options = options;
    this.tools = new Map(options.tools.map((tool) => [tool.name, tool]));
  }

  /** The latest state of every step, in the order the calls were made. */
  get trace(): ToolStep[] {
    return [...this.steps];
  }

  /**
   * Runs one round of calls and returns each call's output for the model, in call order. Arguments are
   * checked and repeats refused in call order first, then the tools run at the same time.
   * Throws `stopped` when the question is stopped.
   */
  async runAll(calls: FunctionCall[]): Promise<string[]> {
    const jobs = calls.map((call) => this.prepare(call));
    const outputs = await Promise.all(jobs.map((job) => (job.kind === 'run' ? this.execute(job) : this.answer(job))));
    if (this.options.context.signal.aborted) throw errors.stopped();
    return outputs;
  }

  private prepare(call: FunctionCall): Job {
    const tool = this.tools.get(call.name);
    if (tool === undefined) {
      const message = agentMessages.unknownTool(call.name, [...this.tools.keys(), this.options.submitTool]);
      return this.answered(call, inputSummary(call.arguments), 'error', message, toJsonText({ error: message }));
    }
    const parsed = parseArguments(call.arguments, tool.parameters);
    const summary = inputSummary(parsed.json);
    if (!parsed.ok) {
      return this.answered(call, summary, 'error', parsed.error, toJsonText({ error: parsed.error, arguments: parsed.json }));
    }
    const key = callKey(call.name, parsed.args);
    if (this.called.has(key)) {
      const message = agentMessages.repeated(call.name);
      return this.answered(call, summary, 'refused', message, toJsonText({ error: message }), REPEAT_STEP_ERROR);
    }
    this.called.add(key);
    return { kind: 'run', call, summary, step: this.start(call.name, summary), tool, args: parsed.args };
  }

  private answered(
    call: FunctionCall,
    summary: string,
    status: 'error' | 'refused',
    message: string,
    output: string,
    stepError = message,
  ): Job {
    return { kind: 'answered', call, summary, step: this.start(call.name, summary), status, message, output, stepError };
  }

  private async answer(job: Extract<Job, { kind: 'answered' }>): Promise<string> {
    this.end(job, { status: job.status, durationMs: 0, error: job.stepError });
    this.log(job, 0, 0, job.message);
    return capOutput(job.output);
  }

  private async execute(job: Extract<Job, { kind: 'run' }>): Promise<string> {
    const { context } = this.options;
    const started = performance.now();
    try {
      const result = await job.tool.run(job.args, context);
      const json = toJsonText(result.output);
      const durationMs = Math.round(performance.now() - started);
      this.end(job, { status: 'ok', durationMs, resultSummary: result.summary });
      this.log(job, durationMs, Buffer.byteLength(json, 'utf8'), null);
      return capOutput(json);
    } catch (error) {
      if (context.signal.aborted) throw errors.stopped();
      const message =
        error instanceof ToolError || error instanceof AppError
          ? error.message
          : agentMessages.toolFailed(error instanceof Error ? error.message : String(error));
      const durationMs = Math.round(performance.now() - started);
      this.end(job, { status: 'error', durationMs, error: message });
      this.log(job, durationMs, 0, message);
      return toJsonText({ error: message });
    }
  }

  private start(name: string, summary: string): number {
    const step: ToolStep = {
      id: `${this.options.questionId}:${this.steps.length + 1}`,
      name,
      inputSummary: summary,
      status: 'running',
      durationMs: null,
      resultSummary: null,
      error: null,
    };
    this.steps.push(step);
    this.options.onEvent({ type: 'step', step });
    return this.steps.length - 1;
  }

  private end(job: Started, patch: Pick<ToolStep, 'status' | 'durationMs'> & Partial<ToolStep>): void {
    const running = this.steps[job.step];
    if (running === undefined) return;
    const step: ToolStep = { ...running, ...patch };
    this.steps[job.step] = step;
    this.options.onEvent({ type: 'step', step });
  }

  private log(job: Started, durationMs: number, resultBytes: number, error: string | null): void {
    this.options.logger.tool({
      questionId: this.options.questionId,
      tool: job.call.name,
      inputSummary: job.summary,
      durationMs,
      resultBytes,
      error,
    });
  }
}
