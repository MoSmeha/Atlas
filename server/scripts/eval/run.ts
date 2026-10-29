import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import type { IndexEvent, ToolStep } from '@atlas/shared';
import { repoRoot } from '../../src/infrastructure/settings';
import { compose, type Container } from '../../src/main';
import type { CheckResult, RunTrace } from './checks';
import { questions, type EvalQuestion } from './questions';
import { renderReport, type QuestionResult } from './report';

const FOLDER = join(repoRoot, 'samples', 'riyadh-tower');
const RUNS_DIR = join(repoRoot, 'eval-runs');

/**
 * pnpm eval [--model <id>] [--only <id,id>]
 * Indexes the sample folder, asks every eval question, checks each answer against samples/expected.json and writes
 * a report to eval-runs/. A full run also copies it to docs/EVAL.md, or docs/EVAL-<provider>.md for Gemini and
 * Ollama, so a free run never replaces the OpenAI report. Failed questions still exit 0: the report is the output.
 */
async function main(): Promise<void> {
  const { values } = parseArgs({ options: { model: { type: 'string' }, only: { type: 'string' } }, allowPositionals: true });
  const selected = pickQuestions(values.only);
  const container = await compose();
  if (container.provider === null) stop(container.providerChoice.reason);
  const published = join(repoRoot, 'docs', container.provider.id === 'openai' ? 'EVAL.md' : `EVAL-${container.provider.id}.md`);
  const model = pickModel(container, values.model);
  console.log(`${container.provider.label}: model ${model}, ${selected.length} of ${questions.length} questions`);

  const indexSeconds = await indexSamples(container);
  const runId = Date.now().toString(36);
  const results: QuestionResult[] = [];
  for (const [index, question] of selected.entries()) {
    const result = await ask(container, question, `eval-${runId}-${question.session ?? question.id}`, model);
    results.push(result);
    const position = `[${String(index + 1).padStart(2)}/${selected.length}]`;
    const cost = `$${(result.usage?.costUsd ?? 0).toFixed(4)}`;
    console.log(`${position} ${question.id.padEnd(20)} ${result.pass ? 'pass' : 'FAIL'}  ${(result.durationMs / 1000).toFixed(1)} s  ${cost}  ${result.reason}`);
  }

  const date = new Date();
  const subset = selected.length < questions.length;
  const report = renderReport({ date, model, folder: relative(repoRoot, FOLDER).replaceAll('\\', '/'), indexSeconds, subset, results });
  mkdirSync(RUNS_DIR, { recursive: true });
  const path = join(RUNS_DIR, `${stamp(date)}-${model.replace(/[^\w.-]+/g, '_')}.md`);
  writeFileSync(path, report, 'utf8');
  if (!subset) copyFileSync(path, published);
  const passed = results.filter((result) => result.pass).length;
  const total = results.reduce((sum, result) => sum + (result.usage?.costUsd ?? 0), 0);
  const publishedName = relative(repoRoot, published).replaceAll('\\', '/');
  console.log(`\nPassed ${passed} of ${results.length}, cost $${total.toFixed(4)}`);
  console.log(`Report: ${relative(repoRoot, path)}${subset ? ` (subset run, ${publishedName} left as it was)` : `, copied to ${publishedName}`}`);
}

/** The questions named by --only, in list order, with the earlier questions their follow-ups need. */
function pickQuestions(only: string | undefined): EvalQuestion[] {
  if (only === undefined) return questions;
  const wanted = new Set(only.split(',').map((id) => id.trim()).filter((id) => id !== ''));
  const unknown = [...wanted].filter((id) => !questions.some((question) => question.id === id));
  if (unknown.length > 0) stop(`Unknown question id: ${unknown.join(', ')}. Ids: ${questions.map((question) => question.id).join(', ')}`);
  for (const question of questions) if (wanted.has(question.id)) for (const id of question.after ?? []) wanted.add(id);
  return questions.filter((question) => wanted.has(question.id));
}

/** --model when it is one of the lineup's three models, otherwise the configured default answer model. */
function pickModel(container: Container, requested: string | undefined): string {
  const ids = Object.values(container.lineup).map((model) => model.id);
  if (requested === undefined) return container.lineup[container.modelConfig.answerTier].id;
  if (!ids.includes(requested)) stop(`Model ${requested} is not in the lineup. Use one of: ${ids.join(', ')}`);
  return requested;
}

/** Loads the sample folder and waits until it is ready, printing each phase and progress step once. */
async function indexSamples(container: Container): Promise<number> {
  const started = performance.now();
  let last = '';
  const unsubscribe = container.workspace.subscribe((event: IndexEvent) => {
    if (event.type !== 'progress') return;
    const line = `  ${event.phase}: ${event.progress.message}`;
    if (line !== last) console.log(line);
    last = line;
  });
  console.log(`Indexing ${relative(repoRoot, FOLDER)}`);
  await container.indexFolder.load(FOLDER);
  const status = await container.indexFolder.idle();
  unsubscribe();
  if (status.phase !== 'ready') stop(`Indexing ended in phase ${status.phase}: ${status.error?.message ?? 'no detail'}`);
  const seconds = (performance.now() - started) / 1000;
  const byStatus = new Map<string, number>();
  for (const document of status.documents) byStatus.set(document.status, (byStatus.get(document.status) ?? 0) + 1);
  console.log(`Ready in ${seconds.toFixed(1)} s: ${[...byStatus].map(([name, count]) => `${count} ${name}`).join(', ')}`);
  return seconds;
}

async function ask(container: Container, question: EvalQuestion, sessionId: string, model: string): Promise<QuestionResult> {
  const steps = new Map<string, ToolStep>();
  const started = performance.now();
  const outcome = await container.askQuestion.execute({
    sessionId,
    question: question.question,
    model,
    onEvent: (event) => {
      if (event.type === 'step') steps.set(event.step.id, event.step);
    },
  });
  const trace: RunTrace = { steps: [...steps.values()], exportsDir: container.settings.exportsDir };
  const base = { id: question.id, question: question.question, steps: trace.steps.map((step) => step.name) };
  if (!outcome.ok) {
    const durationMs = Math.round(performance.now() - started);
    return { ...base, pass: false, reason: `error ${outcome.error.code}: ${outcome.error.message}`, answer: null, usage: null, durationMs };
  }
  let result: CheckResult;
  try {
    result = question.check(outcome.answer, outcome.usage, trace);
  } catch (error) {
    result = { pass: false, reason: `the check itself failed: ${error instanceof Error ? error.message : String(error)}` };
  }
  return { ...base, ...result, answer: outcome.answer, usage: outcome.usage, durationMs: outcome.usage.durationMs };
}

/** "20261028-2241", in the machine's time zone. */
function stamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function stop(message: string): never {
  console.error(message);
  process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
