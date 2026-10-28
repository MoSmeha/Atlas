/** The generated sample project, relative to the Atlas folder. */
export const SAMPLE_FOLDER = 'samples/riyadh-tower';

/** Trims a typed path and drops the quotes File Explorer's "Copy as path" puts around it. */
export function cleanFolderPath(raw: string): string {
  const trimmed = raw.trim();
  const quoted = /^"(.*)"$/.exec(trimmed);
  return quoted ? (quoted[1] ?? '').trim() : trimmed;
}
