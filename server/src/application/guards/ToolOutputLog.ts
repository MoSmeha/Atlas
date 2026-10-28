import type { Tool } from '../tools/Tool';

/**
 * Keeps what the tools return while one question is answered, so checkAnswer can trace the answer's numbers to
 * them. Use a new log for every question.
 */
export class ToolOutputLog {
  private readonly kept: unknown[] = [];

  /** Every successful output so far, in the order the tools finished. */
  get outputs(): readonly unknown[] {
    return this.kept;
  }

  /** The same tools, each also keeping its output here. Failed calls keep nothing. */
  watch(tools: readonly Tool[]): Tool[] {
    return tools.map(
      (tool): Tool => ({
        ...tool,
        run: async (args, context) => {
          const result = await tool.run(args, context);
          this.kept.push(result.output);
          return result;
        },
      }),
    );
  }
}
