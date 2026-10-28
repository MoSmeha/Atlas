/** JSON.parse that returns undefined for text that is not JSON, so a schema check can reject it. */
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
