import { describe, expect, it } from 'vitest';
import { toResponseInput } from '../../../src/infrastructure/openai/inputItems';

describe('toResponseInput', () => {
  it('maps plain user and assistant messages', () => {
    expect(
      toResponseInput([
        { type: 'message', role: 'user', content: 'What is the total?' },
        { type: 'message', role: 'assistant', content: 'SAR 1,200.' },
      ]),
    ).toEqual([
      { type: 'message', role: 'user', content: 'What is the total?' },
      { type: 'message', role: 'assistant', content: 'SAR 1,200.' },
    ]);
  });

  it('sends a page image as a high-detail PNG data URL next to the text', () => {
    const [item] = toResponseInput([
      {
        type: 'message',
        role: 'user',
        content: [
          { type: 'text', text: 'Page 4 of spec.pdf' },
          { type: 'image', pngBase64: 'iVBORw0KGgo=' },
        ],
      },
    ]);
    expect(item).toEqual({
      type: 'message',
      role: 'user',
      content: [
        { type: 'input_text', text: 'Page 4 of spec.pdf' },
        { type: 'input_image', image_url: 'data:image/png;base64,iVBORw0KGgo=', detail: 'high' },
      ],
    });
  });

  it('joins assistant content parts into text, since only users send images', () => {
    const [item] = toResponseInput([
      {
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'text', text: 'First.' },
          { type: 'image', pngBase64: 'abc' },
          { type: 'text', text: 'Second.' },
        ],
      },
    ]);
    expect(item).toEqual({ type: 'message', role: 'assistant', content: 'First.\n\nSecond.' });
  });

  it('maps a tool output to a function_call_output with its call id', () => {
    expect(toResponseInput([{ type: 'tool_output', callId: 'call_1', output: '{"rows":3}' }])).toEqual([
      { type: 'function_call_output', call_id: 'call_1', output: '{"rows":3}' },
    ]);
  });
});
