/**
 * The chat session id for this page load. The server keeps the chat's turns, saved results and
 * spend under it; a reload starts a new chat, matching the empty conversation on screen.
 */
export const chatSessionId: string = newId();

function newId(): string {
  // randomUUID needs a secure context; plain http on a LAN address only has getRandomValues.
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
