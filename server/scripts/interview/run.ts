import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import { AnswerEffort, type Answer, type IndexEvent, type ToolStep } from '@atlas/shared';
import { pickableEffort, questionEffort } from '../../src/application/models/answerEffort';
import type { CatalogModel } from '../../src/application/models/pickLineup';
import type { ReasoningEffort } from '../../src/application/ports/ModelClient';
import { repoRoot } from '../../src/infrastructure/settings';
import { compose, type Container } from '../../src/main';
import { describeSources, type CheckResult, type RunTrace } from '../eval/checks';
import type { EvalQuestion } from '../eval/questions';
import { localTime, renderReport, type QuestionResult } from '../eval/report';
import { OUT_FOLDER } from './project';
import { questions } from './questions';

const FOLDER = join(repoRoot, OUT_FOLDER);
const RUNS_DIR = join(repoRoot, 'eval-runs');

/**
 * pnpm interview [--model <id>] [--effort low|medium|high] [--only <id,id>]
 * Indexes samples/khobar-park, asks every interview question, checks each answer against
 * samples/khobar-park-expected.json and writes a report with every full answer to eval-runs/interview-*.md.
 * Costs money on a paid provider. Nothing is copied to docs/.
 */
async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { model: { type: 'string' }, effort: { type: 'string' }, only: { type: 'string' } },
    allowPositionals: true,
  });
  const selected = pickQuestions(values.only);
  const container = await compose();
  if (container.provider === null) stop(container.providerChoice.reason);
  const chosen = pickModel(container, values.model);
  const model = chosen.id;
  const configured = container.models.reasoningEffort[chosen.provider] ?? null;
  const effort = pickEffort(configured, values.effort);
  const runsAt = questionEffort(configured, effort);
  console.log(`Model ${model} (${chosen.provider}), effort ${runsAt ?? "the model's own"}, ${selected.length} of ${questions.length} questions`);
  const { seconds: indexSeconds, summary } = await indexFolder(container);
  const runId = Date.now().toString(36);
  const results: QuestionResult[] = [];
  for (const [index, question] of selected.entries()) {
    const result = await ask(container, question, `interview-${runId}-${question.session ?? question.id}`, model, effort);
    results.push(result);
    const position = `[${String(index + 1).padStart(2)}/${selected.length}]`;
    const cost = `$${(result.usage?.costUsd ?? 0).toFixed(4)}`;
    console.log(`${position} ${question.id.padEnd(20)} ${result.pass ? 'pass' : 'FAIL'}  ${(result.durationMs / 1000).toFixed(1)} s  ${cost}  ${result.reason}`);
  }
  const date = new Date();
  const subset = selected.length < questions.length;
  const report = renderReport({ date, model, effort: runsAt, folder: OUT_FOLDER, indexSeconds, subset, results })
    .replace('# Atlas evaluation', '# Atlas interview rehearsal')
    .replace('against the sample folder', 'against the interview rehearsal folder')
    .replace('`samples/expected.json`', '`samples/khobar-park-expected.json`');
  const full = `${report}\n## Loading\n\n${summary}\n\n## Every answer\n\n${results.map(answerSection).join('\n')}`;
  mkdirSync(RUNS_DIR, { recursive: true });
  const path = join(RUNS_DIR, `interview-${stamp(date)}-${model.replace(/[^\w.-]+/g, '_')}${runsAt === null ? '' : `-${runsAt}`}.md`);
  writeFileSync(path, full, 'utf8');
  const passed = results.filter((result) => result.pass).length;
  const total = results.reduce((sum, result) => sum + (result.usage?.costUsd ?? 0), 0);
  console.log(`\nPassed ${passed} of ${results.length}, cost $${total.toFixed(4)}`);
  console.log(`Report: ${relative(repoRoot, path)}`);
}

function pickQuestions(only: string | undefined): EvalQuestion[] {
  if (only === undefined) return questions;
  const wanted = new Set(only.split(',').map((id) => id.trim()).filter((id) => id !== ''));
  const unknown = [...wanted].filter((id) => !questions.some((question) => question.id === id));
  if (unknown.length > 0) stop(`Unknown question id: ${unknown.join(', ')}. Ids: ${questions.map((question) => question.id).join(', ')}`);
  for (const question of questions) if (wanted.has(question.id)) for (const id of question.after ?? []) wanted.add(id);
  return questions.filter((question) => wanted.has(question.id));
}

function pickModel(container: Container, requested: string | undefined): CatalogModel {
  const { options, defaultModel } = container.models;
  if (requested === undefined) return defaultModel;
  const chosen = options.find((model) => model.id === requested);
  if (!chosen) stop(`Model ${requested} is not offered. Use one of: ${options.map((model) => model.id).join(', ')}`);
  return chosen;
}

function pickEffort(configured: ReasoningEffort | null, requested: string | undefined): AnswerEffort | null {
  if (requested === undefined) return null;
  const parsed = AnswerEffort.safeParse(requested);
  if (!parsed.success) stop(`Effort ${requested} is not one of: ${AnswerEffort.options.join(', ')}`);
  if (pickableEffort(configured) === null) stop("This model's provider answers at a fixed effort, so --effort cannot change it.");
  return parsed.data;
}

/** Loads the folder and waits until it is ready; returns the time taken and a summary of every file's status. */
async function indexFolder(container: Container): Promise<{ seconds: number; summary: string }> {
  const started = performance.now();
  let last = '';
  const unsubscribe = container.workspace.subscribe((event: IndexEvent) => {
    if (event.type !== 'progress') return;
    const line = `  ${event.phase}: ${event.progress.message}`;
    if (line !== last) console.log(line);
    last = line;
  });
  console.log(`Indexing ${OUT_FOLDER}`);
  await container.indexFolder.load(FOLDER);
  const status = await container.indexFolder.idle();
  unsubscribe();
  if (status.phase !== 'ready') stop(`Indexing ended in phase ${status.phase}: ${status.error?.message ?? 'no detail'}`);
  const seconds = (performance.now() - started) / 1000;
  const byStatus = new Map<string, number>();
  for (const document of status.documents) byStatus.set(document.status, (byStatus.get(document.status) ?? 0) + 1);
  const counts = [...byStatus].map(([name, count]) => `${count} ${name}`).join(', ');
  console.log(`Ready in ${seconds.toFixed(1)} s: ${counts}`);
  const lines = status.documents.map((document) => `| ${document.path} | ${document.status} | ${(document.statusDetail ?? '').replace(/\s+/g, ' ')} |`);
  const summary = [`Loaded in ${seconds.toFixed(1)} s: ${counts}.`, '', '| File | Status | Detail |', '| --- | --- | --- |', ...lines].join('\n');
  return { seconds, summary };
}

async function ask(container: Container, question: EvalQuestion, sessionId: string, model: string, effort: AnswerEffort | null): Promise<QuestionResult> {
  const steps = new Map<string, ToolStep>();
  const started = performance.now();
  const outcome = await container.askQuestion.execute({
    sessionId,
    question: question.question,
    model,
    effort,
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

/** The full answer of one question, for reading by hand. */
function answerSection(result: QuestionResult): string {
  const lines = [`### ${result.id}: ${result.pass ? 'pass' : 'FAIL'}`, '', `**Question:** ${result.question}`, '', `**Check:** ${result.reason}`, ''];
  const answer = result.answer;
  if (answer === null) return [...lines, '**Answer:** none, the question ended in an error.', ''].join('\n');
  lines.push(`**Answer (${answer.kind}, ${answer.language}):**`, '', ...answer.markdown.trim().split('\n').map((line) => `> ${line}`), '');
  if (answer.table !== null) lines.push(...tableLines(answer.table), '');
  if (answer.unreadableFiles.length > 0) lines.push(`**Unreadable files named:** ${answer.unreadableFiles.join(', ')}`, '');
  if (answer.warnings.length > 0) lines.push(`**Warnings:** ${answer.warnings.join('; ')}`, '');
  lines.push(`**Sources:** ${describeSources(answer)}`, '', `**Tool steps:** ${result.steps.join(', ') || 'none'}`, '');
  return lines.join('\n');
}

function tableLines(table: NonNullable<Answer['table']>): string[] {
  const cell = (value: string | number | null) => (value === null ? '' : String(value).replace(/\s+/g, ' ').replaceAll('|', '\\|'));
  const shown = table.rows.slice(0, 60);
  const lines = [
    `**Table${table.title === null ? '' : `: ${table.title}`}** (${table.totalRows} rows)`,
    '',
    `| ${table.columns.map(cell).join(' | ')} |`,
    `| ${table.columns.map(() => '---').join(' | ')} |`,
    ...shown.map((row) => `| ${row.map(cell).join(' | ')} |`),
  ];
  if (table.rows.length > shown.length) lines.push('', `... ${table.rows.length - shown.length} more rows`);
  return lines;
}

/** "20261030-1412", in the machine's time zone. */
function stamp(date: Date): string {
  return localTime(date).replace(/[-:]/g, '').replace(' ', '-');
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
