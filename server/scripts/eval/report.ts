import type { Answer, Usage } from '@atlas/shared';
import { describeSources } from './checks';

export interface QuestionResult {
  id: string;
  question: string;
  pass: boolean;
  reason: string;
  /** Null when the question ended in an error instead of an answer. */
  answer: Answer | null;
  usage: Usage | null;
  /** Tool calls the model made, in order. */
  steps: string[];
  durationMs: number;
}

export interface ReportInput {
  date: Date;
  model: string;
  folder: string;
  indexSeconds: number;
  /** True when --only picked a subset. */
  subset: boolean;
  results: QuestionResult[];
}

/** The value at the given percentile, nearest rank: p50 of [1, 2, 3, 4] is 2. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1] ?? 0;
}

export function renderReport(input: ReportInput): string {
  const { results } = input;
  const passed = results.filter((result) => result.pass).length;
  const cost = results.reduce((total, result) => total + (result.usage?.costUsd ?? 0), 0);
  const times = results.map((result) => result.durationMs);
  const lines = [
    '# Atlas evaluation',
    '',
    'Each question below was asked of Atlas against the sample folder and checked automatically against the known right answers in `samples/expected.json`. A question passes only when the numbers, the rows and the cited pages or sheets are all right.',
    '',
    `- **Date:** ${localTime(input.date)}`,
    `- **Model:** ${input.model}`,
    `- **Folder:** ${input.folder} (indexed in ${input.indexSeconds.toFixed(1)} s)`,
    `- **Passed:** ${passed} of ${results.length}${input.subset ? ' (a subset, chosen with --only)' : ''}`,
    `- **Total cost:** ${money(cost)}`,
    `- **Answer time:** median ${seconds(percentile(times, 50))}, p90 ${seconds(percentile(times, 90))}`,
    '',
    '| Question | Result | Time | Cost | Steps | Tokens in / cached / out / reasoning | Kind | Reason |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...results.map(row),
  ];
  const failed = results.filter((result) => !result.pass);
  if (failed.length > 0) lines.push('', '## Failed questions', '', ...failed.flatMap(details));
  return `${lines.join('\n')}\n`;
}

function row(result: QuestionResult): string {
  const usage = result.usage;
  const tokens = usage === null ? '-' : [usage.inputTokens, usage.cachedInputTokens, usage.outputTokens, usage.reasoningTokens].map(count).join(' / ');
  return `| ${result.id} | ${result.pass ? 'pass' : '**fail**'} | ${seconds(result.durationMs)} | ${money(usage?.costUsd ?? 0)} | ${result.steps.length} | ${tokens} | ${result.answer?.kind ?? 'error'} | ${cell(short(result.reason, 140))} |`;
}

function details(result: QuestionResult): string[] {
  const lines = [`### ${result.id}`, '', `**Question:** ${result.question}`, '', `**Why it failed:** ${result.reason}`, ''];
  const answer = result.answer;
  if (answer === null) return [...lines, '**Answer:** none, the question ended in an error.', ''];
  lines.push('**Answer excerpt:**', '', ...quote(short(answer.markdown, 900)), '');
  if (answer.table !== null) lines.push(`**Table:** ${answer.table.rows.length} rows; columns ${answer.table.columns.join(', ')}`, '');
  lines.push(`**Sources:** ${describeSources(answer)}`, '', `**Tool steps:** ${result.steps.join(', ') || 'none'}`, '');
  if (answer.warnings.length > 0) lines.push(`**Warnings:** ${answer.warnings.join('; ')}`, '');
  return lines;
}

/** "2026-10-28 22:41", in the machine's time zone. */
export function localTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function quote(text: string): string[] {
  return text.split('\n').map((line) => `> ${line}`);
}

function short(text: string, max: number): string {
  const flat = text.trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 3).trimEnd()}...`;
}

function cell(text: string): string {
  return text.replace(/\s+/g, ' ').replaceAll('|', '\\|');
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

function money(usd: number): string {
  return `$${usd.toFixed(usd < 1 ? 4 : 2)}`;
}

function count(value: number): string {
  return value.toLocaleString('en-US');
}
