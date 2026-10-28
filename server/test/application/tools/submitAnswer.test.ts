import { describe, expect, it } from 'vitest';
import { ANSWER_FIELD } from '../../../src/application/agent/streamAnswer';
import { tools } from '../../../src/application/tools/registry';
import { submitAnswer, submitAnswerParameters } from '../../../src/application/tools/submitAnswer';
import { toFunctionTool } from '../../../src/infrastructure/openai/toolSchema';

const answer = {
  kind: 'answer',
  language: 'en',
  markdown: 'The contract value is SAR 48,250,000.',
  result_id: null,
  sources: [{ document: 'Contract.pdf', page: 4, sheet: null, row_from: null, row_to: null, quote: 'Contract Price' }],
};

describe('submit_answer', () => {
  it('puts kind and language before the streamed markdown field', () => {
    expect(Object.keys(submitAnswerParameters.shape)).toEqual(['kind', 'language', ANSWER_FIELD, 'result_id', 'sources']);
  });

  it('accepts a full answer and rejects unknown fields', () => {
    expect(submitAnswerParameters.parse(answer)).toEqual(answer);
    expect(submitAnswerParameters.safeParse({ ...answer, table: [] }).success).toBe(false);
    expect(submitAnswerParameters.safeParse({ ...answer, kind: 'maybe' }).success).toBe(false);
  });

  it('requires every field, with null for the optional ones', () => {
    const { result_id: _omitted, ...withoutResult } = answer;
    expect(submitAnswerParameters.safeParse(withoutResult).success).toBe(false);
  });

  it('becomes a strict function tool with every property required', () => {
    const tool = toFunctionTool(submitAnswer);
    expect(tool).toMatchObject({ name: 'submit_answer', strict: true });
    const parameters = tool.parameters as { required: string[]; properties: Record<string, { items?: { required: string[] } }> };
    expect(parameters.required).toEqual(['kind', 'language', 'markdown', 'result_id', 'sources']);
    expect(parameters.properties.sources?.items?.required).toEqual(['document', 'page', 'sheet', 'row_from', 'row_to', 'quote']);
  });

  it('is not in the registry, since runAgent adds it itself', () => {
    expect(tools.map((tool) => tool.name)).not.toContain('submit_answer');
  });
});
