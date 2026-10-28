import { zodResponsesFunction } from 'openai/helpers/zod';
import type { FunctionTool } from 'openai/resources/responses/responses';
import type { ToolSpec } from '../../application/ports/ModelClient';

/** A Responses function tool whose parameters are the strict JSON schema of the tool's Zod object. */
export function toFunctionTool(spec: ToolSpec): FunctionTool {
  const tool = zodResponsesFunction({ name: spec.name, description: spec.description, parameters: spec.parameters });
  return {
    type: 'function',
    name: tool.name,
    description: tool.description ?? null,
    parameters: tool.parameters,
    strict: tool.strict,
  };
}
