import type { z } from 'zod';
import type { Clock } from '../ports/Clock';
import type { DocumentIndex } from '../ports/DocumentIndex';
import type { EmbeddingClient } from '../ports/EmbeddingClient';
import type { ModelClient } from '../ports/ModelClient';
import type { PageRenderer } from '../ports/PageRenderer';
import type { ResultExporter } from '../ports/ResultExporter';
import type { Session } from '../session/Session';

/** Everything a tool may use. Tools depend on ports only, never on sqlite, mupdf or openai. */
export interface ToolContext {
  /** Absolute path of the loaded folder. */
  folder: string;
  index: DocumentIndex;
  embeddings: EmbeddingClient;
  model: ModelClient;
  renderer: PageRenderer;
  exporter: ResultExporter;
  session: Session;
  clock: Clock;
  /** Model IDs a tool may call itself: `answer` for vision, `small` for bulk work. */
  models: { answer: string; small: string };
  exportsDir: string;
  signal: AbortSignal;
}

export interface ToolResult {
  /** JSON-serialisable data sent back to the model. */
  output: unknown;
  /** One line for the "How I found this" trace. */
  summary: string;
}

/** A tool the model can call. Parameters are a Zod object with `.nullable()` for optional fields (strict mode). */
export interface Tool<Params extends z.ZodObject = z.ZodObject> {
  name: string;
  /** Fixed text, or built per question, as query_tables does to list every table's schema. */
  description: string | ((context: ToolContext) => string);
  parameters: Params;
  run(args: z.infer<Params>, context: ToolContext): Promise<ToolResult>;
}

/** Keeps the args type of `run` tied to the parameters schema. */
export function defineTool<Params extends z.ZodObject>(tool: Tool<Params>): Tool<Params> {
  return tool;
}

/** A problem the model can fix, such as an unknown document name. Sent back to the model as the tool output. */
export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolError';
  }
}
