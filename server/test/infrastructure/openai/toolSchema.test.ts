import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { toFunctionTool } from '../../../src/infrastructure/openai/toolSchema';

const searchSpec = {
  name: 'search',
  description: 'Searches the loaded documents.',
  parameters: z.object({
    query: z.string().describe('What to look for'),
    document: z.string().nullable().describe('Limit to one file, or null for all'),
    filters: z.object({ sheet: z.string().nullable(), limit: z.number().int() }),
  }),
};

describe('toFunctionTool', () => {
  it('builds a strict function tool', () => {
    const tool = toFunctionTool(searchSpec);
    expect(tool).toMatchObject({ type: 'function', name: 'search', description: 'Searches the loaded documents.', strict: true });
  });

  it('requires every field and closes every object, with null allowed for nullable fields', () => {
    const parameters = toFunctionTool(searchSpec).parameters as Record<string, any>;
    expect(parameters.type).toBe('object');
    expect(parameters.additionalProperties).toBe(false);
    expect([...parameters.required].sort()).toEqual(['document', 'filters', 'query']);

    const document = parameters.properties.document;
    const allowsNull = JSON.stringify(document).includes('"null"');
    expect(allowsNull).toBe(true);

    const filters = parameters.properties.filters;
    expect(filters.additionalProperties).toBe(false);
    expect([...filters.required].sort()).toEqual(['limit', 'sheet']);
  });

  it('keeps field descriptions for the model', () => {
    const parameters = toFunctionTool(searchSpec).parameters as Record<string, any>;
    expect(parameters.properties.query.description).toBe('What to look for');
  });

  it('builds a tool with no parameters', () => {
    const tool = toFunctionTool({ name: 'get_time', description: 'Current time.', parameters: z.object({}) });
    expect(tool.parameters).toMatchObject({ type: 'object', properties: {}, additionalProperties: false });
  });

  it('rejects an optional field that is not nullable, which strict mode cannot express', () => {
    const spec = { name: 'bad', description: 'Bad.', parameters: z.object({ page: z.number().optional() }) };
    expect(() => toFunctionTool(spec)).toThrow(/optional/);
  });

  it('sends only plain enumerable fields to the API', () => {
    expect(Object.keys(toFunctionTool(searchSpec)).sort()).toEqual(['description', 'name', 'parameters', 'strict', 'type']);
  });
});
