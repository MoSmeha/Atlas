/** A fresh chat session id. The server keeps a chat's turns, saved results and spend under it. */
export function newSessionId(): string {
  // randomUUID needs a secure context; plain http on a LAN address only has getRandomValues.
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
