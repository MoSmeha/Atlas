import type { Classification, IndexProgress } from '@atlas/shared';
import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/application/errors';
import { ClassifyDocument } from '../../src/application/indexing/ClassifyDocument';
import { classificationStep, type DocumentClassifier } from '../../src/application/indexing/classificationStep';
import type { IndexStepContext } from '../../src/application/indexing/IndexFolder';
import type { ObjectRequest } from '../../src/application/ports/ModelClient';
import { FakeClock } from '../fakes/FakeClock';
import { FakeIndex } from '../fakes/FakeIndex';
import { FakeModelClient } from '../fakes/FakeModelClient';
import { MemoryRunLogger } from '../fakes/MemoryRunLogger';
import { boqTable, excelRecord, pdfRecord } from '../fakes/records';

const reply = (type: string, typeConfidence = 0.9) => ({
  type,
  type_confidence: typeConfidence,
  project_name: null,
  parties: [],
  contract_value: null,
  key_dates: [],
});

/** Answers by the file name in the input: Contract*, BOQ*, Minutes*; any other name gets an unsure reply. */
function modelByName(model: FakeModelClient, failOn: string | null = null): FakeModelClient {
  model.generateObject = async <T,>(request: ObjectRequest<T>) => {
    model.objectRequests.push(request as ObjectRequest<unknown>);
    const input = String(request.input);
    if (failOn !== null && input.includes(failOn)) throw new AppError('model_error', 'The model call failed: boom');
    const type = /File: (Contract|BOQ|Minutes)/.exec(input)?.[1];
    return { value: request.schema.parse(type ? reply(type) : reply('Other', 0.3)), usage: { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1, reasoningTokens: 0 } };
  };
  return model;
}

function setup(classifier: DocumentClassifier | null = null) {
  const index = new FakeIndex();
  index.save(pdfRecord('Contract.pdf', ['Agreement between the Employer and the Contractor']));
  index.save(excelRecord('BOQ.xlsx', [boqTable([['1.01', 'Site clearance', 1, 2, 2]])]));
  index.save({ ...pdfRecord('Survey.pdf', ['']), status: 'scanned' });
  index.save({ ...pdfRecord('Broken.pdf', []), status: 'corrupt' });
  index.save(pdfRecord('Minutes.pdf', ['Minutes of meeting 7']));
  const model = modelByName(new FakeModelClient());
  const logger = new MemoryRunLogger();
  const progress: IndexProgress[] = [];
  const changedDocuments: string[] = [];
  const controller = new AbortController();
  const context = (changedPaths: string[]): IndexStepContext => ({
    folder: '/p',
    index,
    changedPaths,
    signal: controller.signal,
    report: (entry) => progress.push(entry),
    documentChanged: (path) => changedDocuments.push(path),
  });
  const step = classificationStep({ classifier: classifier ?? new ClassifyDocument(model, 'small-model'), logger, clock: new FakeClock() });
  return { index, model, logger, progress, changedDocuments, controller, context, step };
}

const typeOf = (index: FakeIndex, path: string) => index.find(path)?.classification?.type ?? null;

describe('classificationStep', () => {
  it('classifies the readable documents saved in this pass and skips unreadable ones', async () => {
    const { index, model, progress, changedDocuments, step, context } = setup();
    expect(step.phase).toBe('classifying');
    await step.run(context(['Contract.pdf', 'BOQ.xlsx', 'Survey.pdf', 'Broken.pdf', 'Minutes.pdf']));

    expect(model.objectRequests.map((request) => request.model)).toEqual(['small-model', 'small-model', 'small-model']);
    expect(typeOf(index, 'Contract.pdf')).toBe('Contract');
    expect(typeOf(index, 'BOQ.xlsx')).toBe('BOQ');
    expect(typeOf(index, 'Minutes.pdf')).toBe('Minutes');
    expect(typeOf(index, 'Survey.pdf')).toBeNull();
    expect(changedDocuments.sort()).toEqual(['BOQ.xlsx', 'Contract.pdf', 'Minutes.pdf']);
    expect(progress.map((entry) => entry.message)).toEqual(['Classifying 1 of 3', 'Classifying 2 of 3', 'Classifying 3 of 3']);
    expect(progress.at(-1)).toMatchObject({ current: 3, total: 3 });
  });

  it('also classifies documents with no classification yet, but never the same one twice unless it changed', async () => {
    const { index, model, logger, step, context } = setup();
    index.save(pdfRecord('Note.pdf', ['A short note']));
    await step.run(context([]));
    expect(model.objectRequests).toHaveLength(4);
    expect(typeOf(index, 'Note.pdf')).toBeNull();
    expect(logger.indexed.find((entry) => entry.file === 'Note.pdf')).toMatchObject({ status: 'classified', detail: 'Not confident enough to classify.' });

    await step.run(context([]));
    expect(model.objectRequests).toHaveLength(4);

    await step.run(context(['Note.pdf']));
    expect(model.objectRequests).toHaveLength(5);
  });

  it('logs a failed document and goes on with the others', async () => {
    const { index, model, logger, step, context } = setup();
    modelByName(model, 'File: BOQ.xlsx');
    await step.run(context(['Contract.pdf', 'BOQ.xlsx', 'Minutes.pdf']));

    expect(typeOf(index, 'Contract.pdf')).toBe('Contract');
    expect(typeOf(index, 'Minutes.pdf')).toBe('Minutes');
    expect(typeOf(index, 'BOQ.xlsx')).toBeNull();
    expect(logger.indexed.find((entry) => entry.file === 'BOQ.xlsx')).toMatchObject({ status: 'classification_failed', detail: expect.stringContaining('boom') });
  });

  it('retries a failed document on the next pass', async () => {
    const { index, model, step, context } = setup();
    modelByName(model, 'File: BOQ.xlsx');
    await step.run(context(['BOQ.xlsx']));
    modelByName(model);
    await step.run(context([]));
    expect(typeOf(index, 'BOQ.xlsx')).toBe('BOQ');
  });

  it('does nothing without an API key', async () => {
    const index = new FakeIndex();
    index.save(pdfRecord('Contract.pdf', ['Agreement']));
    const logger = new MemoryRunLogger();
    const step = classificationStep({ classifier: null, logger, clock: new FakeClock() });
    const progress: IndexProgress[] = [];
    await step.run({ folder: '/p', index, changedPaths: ['Contract.pdf'], signal: new AbortController().signal, report: (entry) => progress.push(entry), documentChanged: () => {} });
    expect(progress).toEqual([]);
    expect(logger.indexed).toEqual([]);
  });

  it('stops quietly when the API key is rejected', async () => {
    const calls: string[] = [];
    const rejecting: DocumentClassifier = {
      async classify(document) {
        calls.push(document.path);
        throw new AppError('missing_api_key', 'OPENAI_API_KEY is not set.');
      },
    };
    const { logger, step, context } = setup(rejecting);
    await step.run(context(['Contract.pdf', 'BOQ.xlsx', 'Minutes.pdf']));
    expect(calls.length).toBeLessThanOrEqual(3);
    expect(logger.indexed.map((entry) => entry.status)).toEqual(['classification_skipped']);
  });

  it('runs at most four at a time', async () => {
    let running = 0;
    let most = 0;
    const slow: DocumentClassifier = {
      async classify(): Promise<Classification | null> {
        running++;
        most = Math.max(most, running);
        await new Promise((resolve) => setTimeout(resolve, 5));
        running--;
        return null;
      },
    };
    const { index, step, context } = setup(slow);
    for (let i = 1; i <= 9; i++) index.save(pdfRecord(`Extra${i}.pdf`, [`Extra ${i}`]));
    await step.run(context([]));
    expect(most).toBe(4);
  });

  it('throws stopped when the pass is cancelled', async () => {
    const { controller, step, context, model } = setup();
    controller.abort();
    await expect(step.run(context(['Contract.pdf']))).rejects.toMatchObject({ code: 'stopped' });
    expect(model.objectRequests).toHaveLength(0);
  });
});
