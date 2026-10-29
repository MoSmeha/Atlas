import { z } from 'zod';
import { DocumentSummary } from './documents';
import { ErrorDetail } from './errors';

export const LoadFolderRequest = z.object({ path: z.string().trim().min(1) });
export type LoadFolderRequest = z.infer<typeof LoadFolderRequest>;

export const IndexPhase = z.enum(['idle', 'scanning', 'reading', 'embedding', 'classifying', 'ready', 'error']);
export type IndexPhase = z.infer<typeof IndexPhase>;

/** "Reading BOQ_Phase2.xlsx, 3 of 12". */
export const IndexProgress = z.object({
  current: z.number().int(),
  total: z.number().int(),
  file: z.string().nullable(),
  message: z.string(),
});
export type IndexProgress = z.infer<typeof IndexProgress>;

/**
 * A suggested question in both interface languages. The empty chat shows the one for the interface
 * language, and the answer comes back in that language.
 */
export const SuggestedQuestion = z.object({ en: z.string(), ar: z.string() });
export type SuggestedQuestion = z.infer<typeof SuggestedQuestion>;

export const IndexStatus = z.object({
  folder: z.string().nullable(),
  phase: IndexPhase,
  progress: IndexProgress.nullable(),
  documents: z.array(DocumentSummary),
  suggestions: z.array(SuggestedQuestion),
  error: ErrorDetail.nullable(),
});
export type IndexStatus = z.infer<typeof IndexStatus>;

/** Server-sent events on GET /api/folder/events; the client refreshes its queries on each one. */
export const IndexEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('progress'), phase: IndexPhase, progress: IndexProgress }),
  z.object({ type: z.literal('document'), document: DocumentSummary }),
  z.object({ type: z.literal('removed'), path: z.string() }),
  z.object({ type: z.literal('ready'), folder: z.string() }),
  z.object({ type: z.literal('error'), error: ErrorDetail }),
]);
export type IndexEvent = z.infer<typeof IndexEvent>;
