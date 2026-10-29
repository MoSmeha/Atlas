import { describe, expect, it } from 'vitest';
import type { IndexStepContext } from '../../src/application/indexing/IndexFolder';
import { suggestionsStep } from '../../src/application/indexing/suggestionsStep';
import { suggest } from '../../src/application/indexing/SuggestQuestions';
import { Workspace } from '../../src/application/workspace/Workspace';
import { FakeIndex } from '../fakes/FakeIndex';
import { boqTable, excelRecord, pdfRecord } from '../fakes/records';

function setup() {
  const index = new FakeIndex();
  index.save(pdfRecord('Contract.pdf', ['Agreement between the Employer and the Contractor']));
  index.save(excelRecord('BOQ.xlsx', [boqTable([['1.01', 'Site clearance', 1, 2, 2]])]));
  const workspace = new Workspace();
  workspace.activate('/p', index);
  const controller = new AbortController();
  const context: IndexStepContext = {
    folder: '/p',
    index,
    changedPaths: [],
    signal: controller.signal,
    report: () => {},
    documentChanged: () => {},
  };
  return { index, workspace, controller, context, step: suggestionsStep(workspace) };
}

describe('suggestionsStep', () => {
  it('puts five questions for the indexed documents in the workspace status', async () => {
    const { index, workspace, context, step } = setup();
    expect(step.phase).toBe('classifying');
    await step.run(context);

    const { suggestions } = workspace.status();
    expect(suggestions).toEqual(suggest(index.documents()));
    const english = suggestions.map((question) => question.en);
    expect(suggestions).toHaveLength(5);
    expect(english.slice(0, 2)).toEqual(['What is the total of BOQ.xlsx?', 'List all cost items above SAR\u00a01\u00a0million']);
  });

  it('follows the documents on the next run, classifications included', async () => {
    const { index, workspace, context, step } = setup();
    await step.run(context);
    index.setClassification('Contract.pdf', {
      type: 'Correspondence',
      confidence: 0.9,
      metadata: { projectName: null, parties: [], contractValue: null, keyDates: [] },
    });
    index.remove('BOQ.xlsx');
    await step.run(context);

    const { suggestions } = workspace.status();
    const english = suggestions.map((question) => question.en);
    expect(english.join(' ')).not.toMatch(/BOQ|scope of work/);
    expect(english[0]).toBe('Extract all dates and deliverables from these documents');
  });

  it('leaves the status alone when the pass was cancelled', async () => {
    const { workspace, controller, context, step } = setup();
    controller.abort();
    await step.run(context);
    expect(workspace.status().suggestions).toEqual([]);
  });
});
