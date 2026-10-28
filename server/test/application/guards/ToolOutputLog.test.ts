import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ToolOutputLog } from '../../../src/application/guards/ToolOutputLog';
import { defineTool, ToolError } from '../../../src/application/tools/Tool';
import { makeToolContext } from '../../fakes/toolContext';

const lookup = defineTool({
  name: 'lookup',
  description: (context) => `Looks up items in ${context.folder}.`,
  parameters: z.object({ code: z.string() }),
  async run(args) {
    if (args.code === 'BAD') throw new ToolError('No item BAD.');
    return { output: { code: args.code, amount: 2_000_000 }, summary: `Found ${args.code}` };
  },
});

describe('ToolOutputLog', () => {
  it('keeps each successful output in order and returns results unchanged', async () => {
    const log = new ToolOutputLog();
    const [watched] = log.watch([lookup]);
    const context = makeToolContext();

    expect(await watched?.run({ code: 'A1' }, context)).toEqual({ output: { code: 'A1', amount: 2_000_000 }, summary: 'Found A1' });
    await watched?.run({ code: 'B2' }, context);
    expect(log.outputs).toEqual([
      { code: 'A1', amount: 2_000_000 },
      { code: 'B2', amount: 2_000_000 },
    ]);
    expect(log.calls).toEqual(['lookup', 'lookup']);
  });

  it('keeps no output for a failed call, still names it, and lets the error through', async () => {
    const log = new ToolOutputLog();
    const [watched] = log.watch([lookup]);
    await expect(watched?.run({ code: 'BAD' }, makeToolContext())).rejects.toBeInstanceOf(ToolError);
    expect(log.outputs).toEqual([]);
    expect(log.calls).toEqual(['lookup']);
  });

  it('keeps the name, description and parameters of each tool', () => {
    const [watched] = new ToolOutputLog().watch([lookup]);
    expect(watched).toMatchObject({ name: 'lookup', description: lookup.description, parameters: lookup.parameters });
  });
});
