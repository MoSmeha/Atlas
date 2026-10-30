/**
 * Wraps a file name, path or code in first-strong isolate marks, so inside an Arabic sentence it
 * keeps its own direction and its dots, slashes and colons stay where they belong. Display text only:
 * never put it in a question sent to the server.
 */
export function isolate(text: string): string {
  return `⁨${text}⁩`;
}
