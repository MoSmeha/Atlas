import { describe, expect, it } from 'vitest';
import { Answer } from '@atlas/shared';
import { checkAnswer, MAX_REJECTIONS } from '../../../src/application/guards/checkAnswer';
import { Session } from '../../../src/application/session/Session';
import type { SubmittedAnswer, SubmittedSource } from '../../../src/application/tools/submitAnswer';
import { FakeIndex } from '../../fakes/FakeIndex';
import { boqTable, excelRecord, pdfRecord } from '../../fakes/records';

const contractPage: SubmittedSource = { document: 'Contract.pdf', page: 2, sheet: null, row_from: null, row_to: null, quote: 'Contract Price' };
const boqRows: SubmittedSource = { document: 'BOQ.xlsx', page: null, sheet: 'Bill 1', row_from: 5, row_to: 6, quote: null };

function setup(question = 'What is the contract price?') {
  const index = new FakeIndex();
  index.save(pdfRecord('Contract.pdf', ['Parties', 'The Contract Price is SAR 48,250,000.']));
  index.save(excelRecord('BOQ.xlsx', [boqTable([['A1', 'Concrete', 10, 100, 1000], ['A2', 'Steel', 5, 200, 1000]])]));
  index.save({ ...pdfRecord('Locked.pdf', []), status: 'encrypted', pageCount: null });
  const session = new Session('s1');
  const outputs: unknown[] = [{ document: 'Contract.pdf', pages: [{ page: 2, text: 'The Contract Price is SAR 48,250,000.' }] }];
  const onSubmit = checkAnswer({ question, index, session, toolOutputs: () => outputs });
  return { index, session, outputs, onSubmit };
}

function answer(overrides: Partial<SubmittedAnswer> = {}): SubmittedAnswer {
  return {
    kind: 'answer',
    language: 'en',
    markdown: 'The contract price is **SAR 48,250,000** (about SAR 48.25M).',
    result_id: null,
    sources: [contractPage],
    ...overrides,
  };
}

function feedbackOf(verdict: { accepted: boolean; feedback?: string }): { error: string; problems: string[]; next: string } {
  expect(verdict.accepted).toBe(false);
  return JSON.parse(verdict.feedback ?? '{}') as { error: string; problems: string[]; next: string };
}

describe('checkAnswer', () => {
  it('accepts an answer whose numbers and sources check out', async () => {
    const { onSubmit } = setup();
    const verdict = await onSubmit(answer());
    expect(verdict).toEqual({
      accepted: true,
      value: {
        kind: 'answer',
        language: 'en',
        markdown: 'The contract price is **SAR 48,250,000** (about SAR 48.25M).',
        table: null,
        sources: [{ kind: 'pdf', document: 'Contract.pdf', page: 2, quote: 'Contract Price' }],
        unreadableFiles: [],
        warnings: [],
      },
    });
    if (verdict.accepted) expect(Answer.parse(verdict.value)).toEqual(verdict.value);
  });

  it('rejects an unsupported number and says how to compute it', async () => {
    const { onSubmit } = setup();
    const feedback = feedbackOf(await onSubmit(answer({ markdown: 'The price is SAR 48,250,000, or SAR 52,110,000 with VAT.' })));
    expect(feedback.error).toBe('The answer was not accepted, so the user has not seen it.');
    expect(feedback.problems).toEqual([
      'These numbers are not in any tool output, the question or a cited page or row: "52,110,000". ' +
        'Compute each one with query_tables or calculate and copy the value exactly as the tool returns it, or leave it out.',
    ]);
    expect(feedback.next).toBe('Fix these problems and call submit_answer again.');
  });

  it('reads the tool outputs when the answer is submitted', async () => {
    const { onSubmit, outputs } = setup();
    outputs.push({ expression: 'r1.amount[0] * 1.08', value: 52_110_000 });
    expect((await onSubmit(answer({ markdown: 'SAR 52,110,000 with VAT.' }))).accepted).toBe(true);
  });

  it('accepts numbers the chat already knows from saved results', async () => {
    const { onSubmit, session } = setup();
    session.saveResult({ title: null, columns: ['total'], rows: [[777_777]], sources: [], tool: 'query_tables', detail: null });
    expect((await onSubmit(answer({ markdown: 'Earlier the total was SAR 777,777.' }))).accepted).toBe(true);
  });

  it('accepts Arabic-Indic digits that match a tool output', async () => {
    const { onSubmit } = setup('ما قيمة العقد؟');
    const verdict = await onSubmit(answer({ language: 'ar', markdown: 'قيمة العقد ٤٨٬٢٥٠٬٠٠٠ ريال.' }));
    expect(verdict.accepted).toBe(true);
  });

  it('rejects invalid sources and names each problem', async () => {
    const { onSubmit } = setup();
    const badPage = { ...contractPage, page: 9 };
    const badSheet = { ...boqRows, sheet: 'Bill 7' };
    const feedback = feedbackOf(await onSubmit(answer({ sources: [contractPage, badPage, badSheet] })));
    expect(feedback.problems).toEqual([
      'These sources are not valid: Contract.pdf has 2 pages, so page 9 does not exist. BOQ.xlsx has no sheet "Bill 7"; its sheets are Bill 1. ' +
        'Cite document names, pages, sheets and rows exactly as the tools returned them, or leave the source out.',
    ]);
  });

  it('rejects a result_id that is not in the session', async () => {
    const { onSubmit } = setup();
    const feedback = feedbackOf(await onSubmit(answer({ result_id: 'r4' })));
    expect(feedback.problems).toEqual([
      'result_id r4 is not a saved result in this chat. Use an id a tool returned with its rows, such as r1, or null.',
    ]);
  });

  it('attaches the saved result as a table capped at 200 rows, with its sources', async () => {
    const { onSubmit, session } = setup('List every item');
    const rows = Array.from({ length: 250 }, (_, i) => [`A${i + 1}`, 1000]);
    const saved = session.saveResult({
      title: 'All items',
      columns: ['item_code', 'amount'],
      rows,
      sources: [{ kind: 'excel', document: 'BOQ.xlsx', sheet: 'Bill 1', rowFrom: 5, rowTo: 254 }],
      tool: 'query_tables',
      detail: 'SELECT item_code, amount FROM boq_1',
    });
    const verdict = await onSubmit(answer({ markdown: 'There are 250 items.', result_id: saved.id, sources: [] }));
    if (!verdict.accepted) throw new Error(verdict.feedback);
    expect(verdict.value.table).toMatchObject({ resultId: 'r1', title: 'All items', columns: ['item_code', 'amount'], totalRows: 250 });
    expect(verdict.value.table?.rows).toHaveLength(200);
    expect(verdict.value.sources).toEqual([{ kind: 'excel', document: 'BOQ.xlsx', sheet: 'Bill 1', rowFrom: 5, rowTo: 254 }]);
  });

  it('hides the meta columns from the attached table, keeping the saved result whole', async () => {
    const { onSubmit, session } = setup('List the items');
    const saved = session.saveResult({
      title: 'Items',
      columns: ['item_code', 'amount', '_row', '_page', '_is_total', '_section'],
      rows: [
        ['A1', 1000, 5, null, 0, 'Bill 1'],
        ['A2', 1000, 6, null, 0, 'Bill 1'],
      ],
      sources: [{ kind: 'excel', document: 'BOQ.xlsx', sheet: 'Bill 1', rowFrom: 5, rowTo: 6 }],
      tool: 'query_tables',
      detail: 'SELECT item_code, amount, _row, _page, _is_total, _section FROM boq_1',
    });
    const verdict = await onSubmit(answer({ markdown: 'Two items.', result_id: saved.id, sources: [] }));
    if (!verdict.accepted) throw new Error(verdict.feedback);

    expect(verdict.value.table).toEqual({
      resultId: 'r1',
      title: 'Items',
      columns: ['item_code', 'amount'],
      rows: [
        ['A1', 1000],
        ['A2', 1000],
      ],
      totalRows: 2,
    });
    expect(verdict.value.sources).toEqual([{ kind: 'excel', document: 'BOQ.xlsx', sheet: 'Bill 1', rowFrom: 5, rowTo: 6 }]);
    expect(session.result('r1')?.columns).toHaveLength(6);
  });

  it('accepts with warnings after two rejections, leaving out invalid sources', async () => {
    const { onSubmit } = setup();
    const flawed = answer({ markdown: 'The price is SAR 48,250,000, or SAR 52,110,000 with VAT.', sources: [contractPage, { ...contractPage, page: 9 }] });
    for (let i = 0; i < MAX_REJECTIONS; i++) expect((await onSubmit(flawed)).accepted).toBe(false);

    const verdict = await onSubmit(flawed);
    if (!verdict.accepted) throw new Error(verdict.feedback);
    expect(verdict.value).toMatchObject({
      kind: 'answer',
      markdown: 'The price is SAR 48,250,000, or SAR 52,110,000 with VAT.',
      sources: [{ kind: 'pdf', document: 'Contract.pdf', page: 2, quote: 'Contract Price' }],
    });
    expect(verdict.value.warnings).toEqual([
      'These numbers could not be traced to a tool result or the documents: "52,110,000".',
      'A source was left out because it could not be checked: Contract.pdf has 2 pages, so page 9 does not exist.',
    ]);
  });

  it('turns an answer with no source into not found, naming unreadable files', async () => {
    const { onSubmit } = setup();
    const unsourced = answer({ markdown: 'The price is SAR 99,000,000.', sources: [] });
    const feedback = feedbackOf(await onSubmit(unsourced));
    expect(feedback.problems).toEqual([
      expect.stringContaining('"99,000,000"'),
      'An answer of kind "answer" needs at least one valid source: the PDF page, or the Excel sheet and rows, its facts come from. ' +
        'If the documents do not contain the answer, use kind "not_found".',
    ]);
    await onSubmit(unsourced);

    const verdict = await onSubmit(unsourced);
    if (!verdict.accepted) throw new Error(verdict.feedback);
    expect(verdict.value).toEqual({
      kind: 'not_found',
      language: 'en',
      markdown: 'Not found in the loaded documents.',
      table: null,
      sources: [],
      unreadableFiles: ['Locked.pdf'],
      warnings: ['No source could be checked for this answer, so it is shown as not found.'],
    });
  });

  it('answers not found in Arabic for an Arabic answer', async () => {
    const { index, session } = setup();
    const onSubmit = checkAnswer({ question: 'ما هو موعد التسليم؟', index, session, toolOutputs: () => [], maxRejections: 0 });
    const verdict = await onSubmit(answer({ language: 'ar', markdown: 'موعد التسليم غير مذكور', sources: [] }));
    if (!verdict.accepted) throw new Error(verdict.feedback);
    expect(verdict.value).toMatchObject({ kind: 'not_found', language: 'ar', markdown: 'لم أجد ذلك في المستندات المحمّلة.' });
  });

  it('accepts a not found answer without sources and names unreadable files', async () => {
    const { onSubmit } = setup();
    const markdown = 'The documents do not give a handover date. Locked.pdf could not be read.';
    const verdict = await onSubmit(answer({ kind: 'not_found', markdown, sources: [] }));
    if (!verdict.accepted) throw new Error(verdict.feedback);
    expect(verdict.value).toMatchObject({ kind: 'not_found', markdown, unreadableFiles: ['Locked.pdf'], warnings: [] });
  });

  it('rejects arguments that do not match the submit_answer schema', async () => {
    const { onSubmit } = setup();
    const feedback = feedbackOf(await onSubmit({ kind: 'answer', markdown: 'Hi' }));
    expect(feedback.error).toMatch(/^Invalid arguments: /);
  });
});
