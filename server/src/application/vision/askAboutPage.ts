import type { TokenUsage } from '../../domain/pricing';
import type { ModelClient } from '../ports/ModelClient';
import type { PageRenderer } from '../ports/PageRenderer';
import { ToolError } from '../tools/Tool';
import { PAGE_INSTRUCTIONS, pageQuestionText, type PageQuestion } from './pagePrompt';

export interface PageImageRequest extends PageQuestion {
  /** Absolute path of the PDF on disk. */
  filePath: string;
}

export interface PageVision {
  renderer: PageRenderer;
  model: ModelClient;
  /** A model that accepts images. */
  modelId: string;
  signal?: AbortSignal;
}

/**
 * Renders one PDF page to PNG and asks the model a question about the image, with no tools.
 * Throws a ToolError when the model declines or says nothing, and whatever the renderer or model client throws.
 */
export async function askAboutPage(
  request: PageImageRequest,
  vision: PageVision,
): Promise<{ answer: string; usage: TokenUsage }> {
  const png = await vision.renderer.renderPage(request.filePath, request.page);
  const turn = await vision.model.turn({
    model: vision.modelId,
    instructions: PAGE_INSTRUCTIONS,
    input: [
      {
        type: 'message',
        role: 'user',
        content: [
          { type: 'text', text: pageQuestionText(request) },
          { type: 'image', pngBase64: Buffer.from(png).toString('base64') },
        ],
      },
    ],
    tools: [],
    toolChoice: 'auto',
    previousResponseId: null,
    reasoningEffort: 'low',
    signal: vision.signal,
  });
  const where = `page ${request.page} of ${request.document}`;
  if (turn.refusal !== null) throw new ToolError(`The model declined to describe ${where}: ${turn.refusal}`);
  const answer = turn.text.trim();
  if (answer === '') {
    throw new ToolError(`The model returned no answer about ${where}. Ask a more specific question about the page.`);
  }
  return { answer, usage: turn.usage };
}
