import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AppError, errors } from '../../../src/application/errors';
import type { DocumentRecord } from '../../../src/application/ports/DocumentIndex';
import type { PageRenderer } from '../../../src/application/ports/PageRenderer';
import { lookAtPage, type LookAtPageOutput } from '../../../src/application/tools/lookAtPage';
import { tools } from '../../../src/application/tools/registry';
import { ToolError, type ToolContext } from '../../../src/application/tools/Tool';
import { FakeIndex } from '../../fakes/FakeIndex';
import { FakeModelClient } from '../../fakes/FakeModelClient';
import { FakePageRenderer } from '../../fakes/FakeOutputs';
import { boqTable, excelRecord, pdfRecord } from '../../fakes/records';
import { makeToolContext } from '../../fakes/toolContext';

/** A three-page PDF with no text layer at all. */
const survey: DocumentRecord = {
  ...pdfRecord('Site_Survey_Scanned.pdf', ['', '', '']),
  status: 'scanned',
  scannedPages: [1, 2, 3],
};

const contract = pdfRecord('contracts/Main Contract.pdf', ['Clause 1', 'Clause 2']);

const workbook = excelRecord('BOQ_Phase1.xlsx', [boqTable([['A1', 'Excavation', 120, 45, 5400]])]);

const reply = 'Borehole BH-2: ground level +612.40 m, water not met. The second row is smudged and unreadable.';

function indexWith(...records: DocumentRecord[]): FakeIndex {
  const index = new FakeIndex();
  for (const record of records) index.save(record);
  return index;
}

function setup(overrides: Partial<ToolContext> = {}) {
  const renderer = new FakePageRenderer();
  const model = new FakeModelClient([{ text: reply }]);
  const context = makeToolContext({ index: indexWith(survey, contract, workbook), renderer, model, ...overrides });
  return { renderer, model, context };
}

async function look(context: ToolContext, document: string, page: number, question = 'What does BH-2 show?') {
  const result = await lookAtPage.run({ document, page, question }, context);
  return { output: result.output as LookAtPageOutput, summary: result.summary };
}

async function toolError(promise: Promise<unknown>): Promise<ToolError> {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(ToolError);
  return error as ToolError;
}

describe('look_at_page', () => {
  it('renders a scanned page, sends it as an image to the answer model and cites the page', async () => {
    const { renderer, model, context } = setup();
    const { output, summary } = await look(context, 'Site_Survey_Scanned.pdf', 2);

    expect(output).toEqual({
      document: 'Site_Survey_Scanned.pdf',
      page: 2,
      pageCount: 3,
      answer: reply,
      source: { document: 'Site_Survey_Scanned.pdf', page: 2 },
      note: null,
    });
    expect(summary).toBe('Read page 2 of Site_Survey_Scanned.pdf as an image');
    expect(renderer.rendered).toEqual([{ filePath: join('/folder', 'Site_Survey_Scanned.pdf'), page: 2 }]);

    const [sent] = model.requests;
    expect(sent).toMatchObject({ model: 'frontier-model', tools: [], toolChoice: 'auto' });
    const [message] = sent?.input ?? [];
    expect(message?.type === 'message' && Array.isArray(message.content) ? message.content : []).toEqual([
      { type: 'text', text: expect.stringContaining('Question: What does BH-2 show?') },
      { type: 'image', pngBase64: 'iVBORw==' },
    ]);
  });

  it('finds the document by name, ignoring case and a missing extension', async () => {
    const { renderer, context } = setup();
    const { output } = await look(context, 'main contract', 1);

    expect(output.document).toBe('contracts/Main Contract.pdf');
    expect(renderer.rendered).toEqual([{ filePath: join('/folder', 'contracts/Main Contract.pdf'), page: 1 }]);
  });

  it('points at read_pages when the page has a text layer', async () => {
    const { context } = setup();
    const { output } = await look(context, 'contracts/Main Contract.pdf', 2);

    expect(output.note).toBe(
      'Page 2 also has a text layer: read_pages gives its exact text, which is better for quoting wording.',
    );
  });

  it('gives no note for a scanned page inside a PDF that has text elsewhere', async () => {
    const mixed: DocumentRecord = { ...pdfRecord('Report.pdf', ['Intro', '', 'End']), scannedPages: [2] };
    const { context } = setup({ index: indexWith(mixed) });

    expect((await look(context, 'Report.pdf', 2)).output.note).toBeNull();
  });

  it('lets calculate use the figures read off the page', async () => {
    const { context } = setup();
    await look(context, 'Site_Survey_Scanned.pdf', 2);

    expect(context.session.evidence.has(612.4)).toBe(true);
  });

  it('refuses an Excel file without rendering or calling the model', async () => {
    const { renderer, model, context } = setup();
    const error = await toolError(look(context, 'BOQ_Phase1.xlsx', 1));

    expect(error.message).toBe(
      'BOQ_Phase1.xlsx is an Excel workbook, which has sheets, not pages. Use query_tables to read its rows.',
    );
    expect(renderer.rendered).toEqual([]);
    expect(model.requests).toEqual([]);
  });

  it('refuses a page past the end and says which pages exist', async () => {
    const { renderer, model, context } = setup();
    const error = await toolError(look(context, 'Site_Survey_Scanned.pdf', 4));

    expect(error.message).toBe(
      'Site_Survey_Scanned.pdf has 3 pages, so page 4 does not exist. Ask for a page from 1 to 3.',
    );
    expect(renderer.rendered).toEqual([]);
    expect(model.requests).toEqual([]);
  });

  it('asks for page 1 of a one-page PDF', async () => {
    const { context } = setup({ index: indexWith(pdfRecord('Letter.pdf', ['Dear Sir'])) });

    expect((await toolError(look(context, 'Letter.pdf', 2))).message).toBe(
      'Letter.pdf has 1 page, so page 2 does not exist. Ask for page 1.',
    );
  });

  it('rejects a page number below 1 in the parameters', () => {
    const parsed = lookAtPage.parameters.safeParse({ document: 'Site_Survey_Scanned.pdf', page: 0, question: 'Any?' });
    expect(parsed.success).toBe(false);
  });

  it('explains why an unreadable PDF cannot be shown', async () => {
    const locked: DocumentRecord = {
      ...pdfRecord('Locked.pdf', []),
      status: 'encrypted',
      statusDetail: 'The PDF is password-protected.',
      pageCount: null,
    };
    const { context } = setup({ index: indexWith(locked) });

    expect((await toolError(look(context, 'Locked.pdf', 1))).message).toBe(
      'Locked.pdf cannot be shown. The PDF is password-protected.',
    );
  });

  it('lists the loaded documents for an unknown name', async () => {
    const { context } = setup();
    const error = await toolError(look(context, 'Survey 2019.pdf', 1));

    expect(error.message).toContain('No loaded document matches "Survey 2019.pdf".');
    expect(error.message).toContain('Site_Survey_Scanned.pdf');
  });

  it('asks for a question when it is empty', async () => {
    const { model, context } = setup();

    expect((await toolError(look(context, 'Site_Survey_Scanned.pdf', 1, '   '))).message).toBe(
      'The question is empty. Say what to read or check on the page.',
    );
    expect(model.requests).toEqual([]);
  });

  it('lets model and renderer failures through for the agent loop to report', async () => {
    const limited = new FakeModelClient([
      () => {
        throw errors.rateLimited(20);
      },
    ]);
    const rateLimited = await look(setup({ model: limited }).context, 'Site_Survey_Scanned.pdf', 1).catch(
      (caught: unknown) => caught,
    );
    expect(rateLimited).toBeInstanceOf(AppError);
    expect((rateLimited as AppError).code).toBe('rate_limited');

    const broken: PageRenderer = {
      renderPage: async () => {
        throw errors.invalidRequest('Page 1 of Site_Survey_Scanned.pdf could not be drawn; the PDF may be damaged.');
      },
    };
    const drawn = look(setup({ renderer: broken }).context, 'Site_Survey_Scanned.pdf', 1);
    await expect(drawn).rejects.toThrow('could not be drawn');
  });

  it('is registered for the model', () => {
    expect(tools).toContain(lookAtPage);
  });
});
