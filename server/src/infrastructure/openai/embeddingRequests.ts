/** How texts are grouped into embedding requests. Each limit stays below what the API allows. */
export interface EmbeddingLimits {
  /** Texts per request (the API allows 2,048). */
  maxInputs: number;
  /** Estimated tokens per request (the API allows 300,000). */
  maxRequestTokens: number;
  /** Estimated tokens kept from one text (the API allows 8,192); about 24,000 English characters. */
  maxInputTokens: number;
}

export const EMBEDDING_LIMITS: EmbeddingLimits = { maxInputs: 512, maxRequestTokens: 250_000, maxInputTokens: 8_000 };

/**
 * A cautious token estimate: three ASCII characters per token, and one token for every other character,
 * because Arabic needs far more tokens per character than English.
 */
export function estimateTokens(text: string): number {
  let ascii = 0;
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) < 0x80) ascii++;
  return Math.ceil(ascii / 3) + (text.length - ascii);
}

/** One text as the API should get it: line breaks become spaces, long text is cut, and empty text becomes one space. */
export function toEmbeddingInput(text: string, maxInputTokens: number = EMBEDDING_LIMITS.maxInputTokens): string {
  const input = cutToTokens(text.replace(/\r\n|[\r\n]/g, ' '), maxInputTokens);
  return input === '' ? ' ' : input;
}

/**
 * Cleans the texts and groups them, in input order, into requests within the input and token limits.
 * Flattening the result gives exactly one input per text.
 */
export function planEmbeddingRequests(texts: string[], limits: EmbeddingLimits = EMBEDDING_LIMITS): string[][] {
  const requests: string[][] = [];
  let current: string[] = [];
  let tokens = 0;
  for (const text of texts) {
    const input = toEmbeddingInput(text, limits.maxInputTokens);
    const cost = estimateTokens(input);
    if (current.length > 0 && (current.length >= limits.maxInputs || tokens + cost > limits.maxRequestTokens)) {
      requests.push(current);
      current = [];
      tokens = 0;
    }
    current.push(input);
    tokens += cost;
  }
  if (current.length > 0) requests.push(current);
  return requests;
}

/** The longest start of the text whose estimate fits, never ending halfway through an emoji or other surrogate pair. */
function cutToTokens(text: string, maxTokens: number): string {
  let ascii = 0;
  let other = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) < 0x80) ascii++;
    else other++;
    if (Math.ceil(ascii / 3) + other > maxTokens) return text.slice(0, isHighSurrogate(text.charCodeAt(i - 1)) ? i - 1 : i);
  }
  return text;
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}
