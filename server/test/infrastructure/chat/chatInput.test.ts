import { describe, expect, it } from 'vitest';
import { toChatMessages } from '../../../src/infrastructure/chat/chatInput';

describe('toChatMessages', () => {
  it('turns messages, images and tool outputs into Chat Completions messages', () => {
    expect(
      toChatMessages([
        { type: 'message', role: 'user', content: 'Earlier question' },
        { type: 'message', role: 'assistant', content: [{ type: 'text', text: 'Earlier answer' }, { type: 'image', pngBase64: 'AAAA' }] },
        { type: 'message', role: 'user', content: [{ type: 'text', text: 'What does page 3 show?' }, { type: 'image', pngBase64: 'iVBOR' }] },
        { type: 'tool_output', callId: 'call_1', output: '{"hits":[]}' },
      ]),
    ).toEqual([
      { role: 'user', content: 'Earlier question' },
      { role: 'assistant', content: 'Earlier answer' },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What does page 3 show?' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,iVBOR', detail: 'high' } },
        ],
      },
      { role: 'tool', tool_call_id: 'call_1', content: '{"hits":[]}' },
    ]);
  });
});
