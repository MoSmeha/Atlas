import type { ToolStep } from '@atlas/shared';
import { addUsage, zeroUsage, type TokenUsage } from '../../domain/pricing';
import { errors } from '../errors';
import type { FunctionCall, InputItem, ReasoningEffort, ToolSpec } from '../ports/ModelClient';
import type { RunLogger } from '../ports/RunLogger';
import type { Tool, ToolContext } from '../tools/Tool';
import { agentMessages } from './agentMessages';
import type { AgentEvent } from './events';
import { parseArguments } from './parseArguments';
import { streamAnswer } from './streamAnswer';
import { inputSummary } from './summaries';
import { ToolCaller } from './ToolCaller';
import { capOutput, toJsonText, withNotice } from './toolOutput';

/** Forced answer rounds the model still gets when its answer on the last round is rejected. */
export const EXTRA_ANSWER_ROUNDS = 2;

/** What onSubmit decides about a submitted answer. */
export type SubmitVerdict<T> = { accepted: true; value: T } | { accepted: false; feedback: string };

export interface RunAgentOptions<T> {
  questionId: string;
  /** Model ID used for every turn. */
  model: string;
  instructions: string;
  /** Input of the first turn: the earlier conversation and the question. */
  input: InputItem[];
  tools: Tool[];
  /** The tool the model answers with. Its top-level `markdown` string is streamed to the user. */
  submitTool: ToolSpec;
  /** Passed to every tool. Its model client makes the turns and its signal stops the run. */
  context: ToolContext;
  /** Model turns allowed; the last one must call the submit tool. */
  maxRounds: number;
  reasoningEffort: ReasoningEffort | null;
  logger: RunLogger;
  onEvent: (event: AgentEvent) => void;
  /** Checks the submit tool's arguments: accept them as the final value, or reject them with feedback for the model. */
  onSubmit: (args: unknown) => Promise<SubmitVerdict<T>>;
}

export interface AgentRun<T> {
  value: T;
  /** Model turns made. */
  rounds: number;
  usage: TokenUsage;
  steps: ToolStep[];
}

/**
 * The tool loop. Each round is one model turn that must call tools; their outputs go back as the next
 * turn's input, chained with previousResponseId. The loop ends when onSubmit accepts a call of the submit
 * tool. The last allowed round forces that call; a rejected answer there gets EXTRA_ANSWER_ROUNDS more tries.
 * Throws `model_refusal` when the model refuses, `stopped` when the context's signal aborts, and
 * `model_error` when no answer is accepted in time.
 */
export async function runAgent<T>(options: RunAgentOptions<T>): Promise<AgentRun<T>> {
  const { context, submitTool } = options;
  const specs: ToolSpec[] = [...options.tools.map((tool) => toSpec(tool, context)), submitTool];
  const caller = new ToolCaller({
    questionId: options.questionId,
    tools: options.tools,
    submitTool: submitTool.name,
    context,
    logger: options.logger,
    onEvent: options.onEvent,
  });
  const lastRound = Math.max(1, Math.floor(options.maxRounds));
  let usage = zeroUsage;
  let input = options.input;
  let previousResponseId: string | null = null;

  for (let round = 1; round <= lastRound + EXTRA_ANSWER_ROUNDS; round++) {
    throwIfStopped(context.signal);
    const turn = await context.model.turn({
      model: options.model,
      instructions: options.instructions,
      input,
      tools: specs,
      toolChoice: round >= lastRound ? { name: submitTool.name } : 'required',
      previousResponseId,
      reasoningEffort: options.reasoningEffort,
      signal: context.signal,
      onEvent: streamAnswer(submitTool.name, options.onEvent),
    });
    usage = addUsage(usage, turn.usage);
    throwIfStopped(context.signal);
    if (turn.refusal !== null) throw errors.modelRefusal(turn.refusal);
    previousResponseId = turn.responseId;

    const outputs = new Map<string, string>();
    for (const call of turn.functionCalls.filter((call) => call.name === submitTool.name)) {
      const verdict = await submit(call, options);
      if (verdict.accepted) return { value: verdict.value, rounds: round, usage, steps: caller.trace };
      options.onEvent({ type: 'answer_reset' });
      outputs.set(call.callId, verdict.feedback);
    }
    const toolCalls = turn.functionCalls.filter((call) => call.name !== submitTool.name);
    const results = await caller.runAll(toolCalls);
    toolCalls.forEach((call, i) => outputs.set(call.callId, results[i] ?? ''));

    input = nextInput(turn.functionCalls, outputs, submitTool.name, round + 1 >= lastRound);
  }
  throw errors.modelError(`it gave no acceptable answer within ${lastRound + EXTRA_ANSWER_ROUNDS} rounds.`);
}

function toSpec(tool: Tool, context: ToolContext): ToolSpec {
  const description = typeof tool.description === 'function' ? tool.description(context) : tool.description;
  return { name: tool.name, description, parameters: tool.parameters };
}

/** Checks the submit call's arguments, lets onSubmit judge them and logs the attempt. */
async function submit<T>(call: FunctionCall, options: RunAgentOptions<T>): Promise<SubmitVerdict<T>> {
  const started = performance.now();
  const parsed = parseArguments(call.arguments, options.submitTool.parameters);
  const verdict: SubmitVerdict<T> = parsed.ok
    ? await options.onSubmit(parsed.args)
    : { accepted: false, feedback: capOutput(toJsonText({ error: parsed.error, arguments: parsed.json })) };
  options.logger.tool({
    questionId: options.questionId,
    tool: call.name,
    inputSummary: inputSummary(parsed.json),
    durationMs: Math.round(performance.now() - started),
    resultBytes: verdict.accepted ? 0 : Buffer.byteLength(verdict.feedback, 'utf8'),
    error: verdict.accepted ? null : verdict.feedback,
  });
  return verdict;
}

/**
 * The next turn's input: one output per call in the order the model made them, or a nudge when it wrote
 * text without calling anything. Before the last round the model is told it must answer now.
 */
function nextInput(calls: FunctionCall[], outputs: Map<string, string>, submitTool: string, answerNow: boolean): InputItem[] {
  if (calls.length === 0) {
    const content = answerNow ? agentMessages.lastRound(submitTool) : agentMessages.nudge(submitTool);
    return [{ type: 'message', role: 'user', content }];
  }
  return calls.map((call, i): InputItem => {
    const output = outputs.get(call.callId) ?? '';
    const isLast = i === calls.length - 1;
    return {
      type: 'tool_output',
      callId: call.callId,
      output: answerNow && isLast ? withNotice(output, agentMessages.lastRound(submitTool)) : output,
    };
  });
}

function throwIfStopped(signal: AbortSignal): void {
  if (signal.aborted) throw errors.stopped();
}
