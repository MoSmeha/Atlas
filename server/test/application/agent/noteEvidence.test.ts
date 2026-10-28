import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { noteEvidence } from '../../../src/application/agent/noteEvidence';
import { defineTool, ToolError } from '../../../src/application/tools/Tool';
import { makeToolContext } from '../../fakes/toolContext';

const pages = defineTool({
  name: 'pages',
  description: 'Reads a page.',
  parameters: z.object({ page: z.number() }),
  async run(args) {
    if (args.page === 0) throw new ToolError('No page 0; costs SAR 999,999.');
    return { output: { page: args.page, text: 'The advance payment is SAR 1,250,000.' }, summary: 'Read' };
  },
});

describe('noteEvidence', () => {
  it('keeps the tool as it is and notes the numbers of its output', async () => {
    const [wrapped] = noteEvidence([pages]);
    const context = makeToolContext();
    expect(wrapped?.name).toBe('pages');
    expect(wrapped?.parameters).toBe(pages.parameters);

    const result = await wrapped?.run({ page: 4 }, context);
    expect(result?.summary).toBe('Read');
    expect(context.session.evidence.has(1250000)).toBe(true);
  });

  it('notes nothing when the tool fails', async () => {
    const [wrapped] = noteEvidence([pages]);
    const context = makeToolContext();
    await expect(wrapped?.run({ page: 0 }, context)).rejects.toThrow(ToolError);
    expect(context.session.evidence.has(999999)).toBe(false);
  });
});
