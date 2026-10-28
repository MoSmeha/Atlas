import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { FastifyRequest } from 'fastify';
import { IndexStatus, routes } from '@atlas/shared';
import { AppError, errors } from '../../application/errors';
import type { IndexFolder } from '../../application/indexing/IndexFolder';
import { safeFileName } from '../../domain/fileName';
import type { RoutePlugin } from '../zod';

export interface UploadsDeps {
  indexFolder: IndexFolder;
  /** `<dataDir>/uploads`: every uploaded file lands here and the folder is loaded as a whole. */
  uploadsDir: string;
  maxFileBytes: number;
}

/** Files one upload may carry. */
export const MAX_UPLOAD_FILES = 100;

interface Received {
  name: string;
  /** Hidden while it arrives, so neither a scan nor the watcher sees half a file. */
  temp: string;
}

export const uploadsRoutes: RoutePlugin<{ deps: UploadsDeps }> = async (app, { deps }) => {
  app.post(routes.uploads, { schema: { response: { 202: IndexStatus } } }, async (request, reply) => {
    if (!request.isMultipart()) throw errors.invalidRequest('Send the files as multipart form data.');
    await mkdir(deps.uploadsDir, { recursive: true });
    const received = await receiveFiles(request, deps);
    for (const file of received) await rename(file.temp, join(deps.uploadsDir, file.name));
    const status = await deps.indexFolder.load(deps.uploadsDir);
    return reply.status(202).send(status);
  });
};

/** Writes every file of the request to a hidden temporary file. Nothing is kept when one of them is too large. */
async function receiveFiles(request: FastifyRequest, deps: UploadsDeps): Promise<Received[]> {
  const received: Received[] = [];
  const tooLarge: string[] = [];
  try {
    for await (const part of request.files({ throwFileSizeLimit: false })) {
      const file = { name: safeFileName(part.filename), temp: join(deps.uploadsDir, `.${randomUUID()}.partial`) };
      received.push(file);
      await pipeline(part.file, createWriteStream(file.temp));
      if (part.file.truncated) tooLarge.push(part.filename || file.name);
    }
  } catch (error) {
    await discard(received);
    throw uploadError(error);
  }
  if (tooLarge.length > 0) {
    await discard(received);
    const megabytes = Math.round((deps.maxFileBytes / (1024 * 1024)) * 10) / 10;
    const verb = tooLarge.length === 1 ? 'is' : 'are';
    throw errors.invalidRequest(`${tooLarge.join(', ')} ${verb} larger than the ${megabytes} MB limit, so nothing was uploaded.`);
  }
  if (received.length === 0) throw errors.invalidRequest('Choose at least one PDF or Excel file to upload.');
  return received;
}

async function discard(received: readonly Received[]): Promise<void> {
  await Promise.all(received.map((file) => rm(file.temp, { force: true })));
}

/** Multipart limit errors become plain-language invalid_request errors; anything else stays as it is. */
function uploadError(error: unknown): unknown {
  if (error instanceof AppError || !(error instanceof Error)) return error;
  const { code, statusCode } = error as Error & { code?: string; statusCode?: number };
  if (code === 'FST_FILES_LIMIT') return errors.invalidRequest(`Upload at most ${MAX_UPLOAD_FILES} files at a time.`);
  if (typeof statusCode === 'number' && statusCode < 500) return errors.invalidRequest(`The upload could not be read: ${error.message}.`);
  return error;
}
