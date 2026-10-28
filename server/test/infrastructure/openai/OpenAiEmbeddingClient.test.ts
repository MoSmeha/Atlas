import type OpenAI from 'openai';
import { AuthenticationError, RateLimitError } from 'openai';
import { describe, expect, it } from 'vitest';
import { AppError } from '../../../src/application/errors';
import { OpenAiEmbeddingClient } from '../../../src/infrastructure/openai/OpenAiEmbeddingClient';

interface Call {
  body: { model: string; input: string[]; dimensions: number };
  options: { signal?: AbortSignal };
}

type Embedding = { index: number; embedding: number[] };

/** One embedding per input: [input length, position in the request]. Tokens are one per input. */
function echo(input: string[]): Embedding[] {
  return input.map((text, index) => ({ index, embedding: [text.length, index] }));
}

/** A stand-in for the SDK client that records each request and answers with the given handler. No network. */
function stubOpenAi(answer: (input: string[]) => Embedding[] | Error = echo) {
  const calls: Call[] = [];
  const client = {
    embeddings: {
      create: async (body: Call['body'], options: Call['options']) => {
        calls.push({ body, options });
        const data = answer(body.input);
        if (data instanceof Error) throw data;
        return { object: 'list', model: body.model, data, usage: { prompt_tokens: body.input.length, total_tokens: body.input.length } };
      },
    },
  };
  const embeddings = new OpenAiEmbeddingClient(client as unknown as OpenAI, { id: 'text-embedding-3-small', dimensions: 1536 });
  return { embeddings, calls };
}

async function rejection(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error('expected the promise to reject');
}

describe('OpenAiEmbeddingClient', () => {
  it('sends the model, dimensions, cleaned inputs and the abort signal', async () => {
    const { embeddings, calls } = stubOpenAi();
    const signal = new AbortController().signal;
    const result = await embeddings.embed(['Scope\nof works', ''], signal);
    expect(embeddings.model).toBe('text-embedding-3-small');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.body).toEqual({ model: 'text-embedding-3-small', input: ['Scope of works', ' '], dimensions: 1536 });
    expect(calls[0]?.options.signal).toBe(signal);
    expect(result.vectors).toEqual([new Float32Array([14, 0]), new Float32Array([1, 1])]);
    expect(result.tokens).toBe(2);
  });

  it('splits many texts into several requests and joins the vectors in input order', async () => {
    const { embeddings, calls } = stubOpenAi();
    const texts = Array.from({ length: 600 }, (_, i) => 'x'.repeat(i + 1));
    const { vectors, tokens } = await embeddings.embed(texts);
    expect(calls.map((call) => call.body.input.length)).toEqual([512, 88]);
    expect(vectors).toHaveLength(600);
    expect(vectors.map((vector) => vector[0])).toEqual(texts.map((text) => text.length));
    expect(tokens).toBe(600);
  });

  it('puts embeddings back in input order when the API lists them out of order', async () => {
    const { embeddings } = stubOpenAi((input) => echo(input).reverse());
    const { vectors } = await embeddings.embed(['a', 'bb', 'ccc']);
    expect(vectors.map((vector) => vector[0])).toEqual([1, 2, 3]);
  });

  it('makes no request for no texts', async () => {
    const { embeddings, calls } = stubOpenAi();
    expect(await embeddings.embed([])).toEqual({ vectors: [], tokens: 0 });
    expect(calls).toHaveLength(0);
  });

  it('refuses a reply with a missing embedding instead of shifting vectors', async () => {
    const { embeddings } = stubOpenAi((input) => echo(input).slice(1));
    const error = await rejection(embeddings.embed(['a', 'b']));
    expect(error.code).toBe('model_error');
    expect(error.message).toContain('asked for 2 embeddings but got 1');
  });

  it('explains SDK errors through mapOpenAiError', async () => {
    const rejected = new AuthenticationError(401, { message: 'Incorrect API key provided' }, undefined, new Headers());
    expect((await rejection(stubOpenAi(() => rejected).embeddings.embed(['a']))).code).toBe('missing_api_key');
    const limited = new RateLimitError(429, { code: 'rate_limit_exceeded' }, undefined, new Headers({ 'retry-after': '3' }));
    const error = await rejection(stubOpenAi(() => limited).embeddings.embed(['a']));
    expect(error.code).toBe('rate_limited');
    expect(error.retryAfterSeconds).toBe(3);
  });

  it('reports stopped when the signal was aborted', async () => {
    const controller = new AbortController();
    const { embeddings } = stubOpenAi(() => {
      controller.abort();
      return new Error('fetch aborted');
    });
    expect((await rejection(embeddings.embed(['a'], controller.signal))).code).toBe('stopped');
  });
});
