/** Why a file could not be read from disk, in plain language, for a reader's 'corrupt' status. */
export function describeReadError(error: unknown): string {
  const code = error instanceof Error && 'code' in error ? String(error.code) : '';
  if (code === 'ENOENT') return 'The file was removed before it could be read.';
  if (code === 'EACCES' || code === 'EPERM') return 'Atlas does not have permission to read the file.';
  if (code === 'EBUSY') return 'The file is locked by another program.';
  return 'The file could not be read.';
}
