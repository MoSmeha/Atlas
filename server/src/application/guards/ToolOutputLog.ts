import type { Tool } from '../tools/Tool';

/**
 * Keeps what the tools return while one question is answered, so checkAnswer can trace the answer's numbers to
 * them, and which tools were called. Use a new log for every question.
 */
export class ToolOutputLog {
  private readonly kept: unknown[] = [];
  private readonly called: string[] = [];

  /** Every successful output so far, in the order the tools finished. */
  get outputs(): readonly unknown[] {
    return this.kept;
  }

  /** The name of every tool run so far, failed calls included, in the order they started. */
  get calls(): readonly string[] {
    return this.called;
  }

  /** The same tools, each also keeping its name and output here. Failed calls keep no output. */
  watch(tools: readonly Tool[]): Tool[] {
    return tools.map(
      (tool): Tool => ({
        ...tool,
        run: async (args, context) => {
          this.called.push(tool.name);
          const result = await tool.run(args, context);
          this.kept.push(result.output);
          return result;
        },
      }),
    );
  }
}
