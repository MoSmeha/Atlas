import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { z } from 'zod';

/** The Atlas repository root; relative paths in settings start here. */
export const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))
  .optional();

const EnvSchema = z.object({
  OPENAI_API_KEY: optionalText,
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  ATLAS_FOLDER: optionalText,
  ATLAS_DATA_DIR: z.string().default('.atlas'),
  ATLAS_LOG_DIR: z.string().default('.logs'),
  ATLAS_EXPORTS_DIR: z.string().default('exports'),
  ATLAS_MAX_FILE_MB: z.coerce.number().positive().default(200),
  ATLAS_MAX_ROUNDS: z.coerce.number().int().min(2).max(40).default(12),
});

export interface Settings {
  openAiApiKey: string | null;
  port: number;
  host: string;
  /** Folder to load when the server starts, if any. */
  startFolder: string | null;
  /** Index cache and uploads. */
  dataDir: string;
  logDir: string;
  exportsDir: string;
  maxFileBytes: number;
  maxRounds: number;
}

/** Reads `.env` at the repo root; real environment variables win over the file. */
export function loadSettings(
  env: NodeJS.ProcessEnv = process.env,
  envFile: string = resolve(repoRoot, '.env'),
): Settings {
  const fromFile = existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {};
  const parsed = EnvSchema.parse({ ...fromFile, ...definedOnly(env) });
  return {
    openAiApiKey: parsed.OPENAI_API_KEY ?? null,
    port: parsed.PORT,
    host: '127.0.0.1',
    startFolder: parsed.ATLAS_FOLDER ? fromRoot(parsed.ATLAS_FOLDER) : null,
    dataDir: fromRoot(parsed.ATLAS_DATA_DIR),
    logDir: fromRoot(parsed.ATLAS_LOG_DIR),
    exportsDir: fromRoot(parsed.ATLAS_EXPORTS_DIR),
    maxFileBytes: Math.round(parsed.ATLAS_MAX_FILE_MB * 1024 * 1024),
    maxRounds: parsed.ATLAS_MAX_ROUNDS,
  };
}

function fromRoot(path: string): string {
  return isAbsolute(path) ? path : resolve(repoRoot, path);
}

function definedOnly(env: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined));
}
