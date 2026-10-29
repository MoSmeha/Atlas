import type { ChatCompletionFunctionTool } from 'openai/resources/chat/completions';
import type { ModelTurnRequest, ReasoningEffort, ToolSpec } from '../../application/ports/ModelClient';
import { toFunctionTool } from '../openai/toolSchema';

type ChatToolChoice = 'auto' | 'required' | { type: 'function'; function: { name: string } };

/**
 * A Chat Completions function tool with the same strict-shaped JSON schema the Responses adapter sends. The
 * `strict` flag itself is left out: compatible servers do not document it, and the schema already requires every field.
 */
export function toChatTool(spec: ToolSpec): ChatCompletionFunctionTool {
  const tool = toFunctionTool(spec);
  return {
    type: 'function',
    function: {
      name: tool.name,
      ...(tool.description === null ? {} : { description: tool.description }),
      ...(tool.parameters === null ? {} : { parameters: tool.parameters }),
    },
  };
}

export function toChatToolChoice(choice: ModelTurnRequest['toolChoice']): ChatToolChoice {
  return typeof choice === 'string' ? choice : { type: 'function', function: { name: choice.name } };
}

/** Chat Completions stops at high; the levels above it ask for the most it has. */
export function toChatEffort(effort: ReasoningEffort): 'none' | 'minimal' | 'low' | 'medium' | 'high' {
  return effort === 'xhigh' || effort === 'max' ? 'high' : effort;
}
