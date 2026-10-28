import type { Tool } from '../tools/Tool';

/**
 * The same tools, each also noting the numbers in its output as the chat's evidence, so calculate can take them
 * as typed inputs and later answers in the chat may repeat them. Failed calls note nothing.
 */
export function noteEvidence(tools: readonly Tool[]): Tool[] {
  return tools.map(
    (tool): Tool => ({
      ...tool,
      run: async (args, context) => {
        const result = await tool.run(args, context);
        context.session.evidence.noteValue(result.output);
        return result;
      },
    }),
  );
}
