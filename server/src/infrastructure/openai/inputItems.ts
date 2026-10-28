import type { ResponseInputContent, ResponseInputItem } from 'openai/resources/responses/responses';
import type { ContentPart, InputItem } from '../../application/ports/ModelClient';

/** Converts the port's input items into Responses API input items. */
export function toResponseInput(items: InputItem[]): ResponseInputItem[] {
  return items.map(toResponseInputItem);
}

function toResponseInputItem(item: InputItem): ResponseInputItem {
  if (item.type === 'tool_output') {
    return { type: 'function_call_output', call_id: item.callId, output: item.output };
  }
  if (typeof item.content === 'string') {
    return { type: 'message', role: item.role, content: item.content };
  }
  if (item.role === 'assistant') {
    // Assistant turns can only replay text; images are only ever sent by the user side.
    return { type: 'message', role: 'assistant', content: assistantText(item.content) };
  }
  return { type: 'message', role: 'user', content: item.content.map(toInputContent) };
}

function toInputContent(part: ContentPart): ResponseInputContent {
  if (part.type === 'text') return { type: 'input_text', text: part.text };
  return { type: 'input_image', image_url: `data:image/png;base64,${part.pngBase64}`, detail: 'high' };
}

function assistantText(parts: ContentPart[]): string {
  return parts
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join('\n\n');
}
