import type { ChatCompletionContentPart, ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { ContentPart, InputItem } from '../../application/ports/ModelClient';

/** Converts the port's input items into Chat Completions messages. */
export function toChatMessages(items: InputItem[]): ChatCompletionMessageParam[] {
  return items.map(toChatMessage);
}

function toChatMessage(item: InputItem): ChatCompletionMessageParam {
  if (item.type === 'tool_output') return { role: 'tool', tool_call_id: item.callId, content: item.output };
  if (typeof item.content === 'string') return { role: item.role, content: item.content };
  if (item.role === 'assistant') {
    // Assistant turns can only replay text; images are only ever sent by the user side.
    return { role: 'assistant', content: assistantText(item.content) };
  }
  return { role: 'user', content: item.content.map(toContentPart) };
}

function toContentPart(part: ContentPart): ChatCompletionContentPart {
  if (part.type === 'text') return { type: 'text', text: part.text };
  return { type: 'image_url', image_url: { url: `data:image/png;base64,${part.pngBase64}`, detail: 'high' } };
}

function assistantText(parts: ContentPart[]): string {
  return parts
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join('\n\n');
}
